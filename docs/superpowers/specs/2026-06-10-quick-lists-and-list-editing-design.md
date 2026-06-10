# Quick Lists & Full List Editing — Design

**Date:** 2026-06-10
**Status:** approved (design conversation with Kamil, 2026-06-10)

## Problem

Today a shopping list can only be created from a set ("Zrób listę"), and a finished
list is barely editable: the shopping view supports checking items off, appending an
ad-hoc item (which always lands under "Bez sklepu"), and "Zakończ zakupy". There is
no way to rename an item, change its store, remove it, or change the list's store —
even though the snapshot data model (plain-text `storeName` on `list_items`, no FK
back to sets or stores) already isolates lists from sets completely.

Two features fix this:

1. **Quick list** — create an empty list directly from `/lists`, optionally picking
   a store, with no set involved.
2. **Full list editing** — a dedicated edit mode on the list screen, separate from
   the shopping (check-off) view, where everything is editable.

Key insight from the design conversation: **the DB schema is not broken** — lists are
already independent 1:1 snapshots and `lists.setId` is already nullable (provenance
only). The gap is one missing column and missing UI.

## Data model

One additive schema change:

- `lists.storeName` — `text`, nullable. The list's **default store**, stored as a
  plain-text name snapshot (same philosophy as `list_items.storeName`: deleting a
  store from the catalog must never mutate an existing list).

Store resolution for a list item — an exact analogy of sets
(`sets.defaultStoreId` + `set_items.storeId` override):

| `list_items.storeName` | `lists.storeName` | effective store    |
| ---------------------- | ----------------- | ------------------ |
| set                    | (any)             | the item's value   |
| `NULL`                 | set               | the list's default |
| `NULL`                 | `NULL`            | "Bez sklepu"       |

Migration is additive (`pnpm db:generate` → `pnpm db:migrate`). **No data wipe.**
Existing lists have the store name stamped into every item, so they render
identically under the new resolution rule.

## Creating lists

### From a set ("Zrób listę")

Copy semantics in `src/lib/offline/make-list.ts` change:

- the set's default store name is copied to `lists.storeName` (text snapshot);
- an item gets its own `list_items.storeName` **only** when it had an `@store`
  override in the set; otherwise `NULL` (inherits the list default).

Effect: changing the list's store later re-points every non-overridden item at
once — the set is untouched. This directly serves the original use case ("the set
assumes Biedronka, but today I'm shopping at Lidl").

### Quick list (new)

On `/lists`: a "Nowa lista" button opens a dialog with:

- **name** — text input, default "Szybkie zakupy" (the creation date is already
  shown in the list subtitle);
- **store** — optional, picked from the user's store catalog, saved as text into
  `lists.storeName`.

Creates a list with `setId: null` and an empty item set, written through the
offline mirror (`saveLocal` + `pushLocal`), then navigates to `/lists/[id]`
**directly in edit mode** so products can be added immediately (signalled on the
same route, e.g. a `?edit=1` query param — no new route, so no service-worker
changes).

## Shopping view (`/lists/[id]`, mostly unchanged)

- Check-off behaviour unchanged.
- Grouping key becomes `item.storeName ?? list.storeName ?? "Bez sklepu"`.
- The quick-add input at the bottom stays; a new item is created with
  `storeName: null`, i.e. it now inherits the list's store (today it always landed
  under "Bez sklepu").
- Header gains an **"Edytuj"** button next to "Zakończ zakupy".

## Edit mode (in place)

Same URL — the screen toggles between shopping view and edit mode via component
state (no routing change, no service-worker / offline-shell work; detail pages
keep reading the id from `window.location` as before).

Look and interactions mirror the set editor (`src/components/set-editor/`):

- list name edited inline (commit on blur/Enter, revert on empty);
- "Domyślny sklep" section — chip + picker from the store catalog, including
  creating a new store inline (as in the set editor); selection is saved as the
  store's **name** (text) into `lists.storeName`;
- product rows: rename, store override (with a visible "inherits" state when
  `storeName` is `NULL`), delete (soft-delete), reorder (arrows + drag, the
  `(i+1)*10` renumbering scheme);
- "Gotowe" returns to the shopping view.

`ProductRow` / `DefaultStorePicker` operate on store **ids**; the list editor needs
thin variants that write the **name** as text. Whether that's an adapted copy or a
light generalization of the shared component is an implementation decision — the
UX must be identical to the set editor.

## Offline & sync

Every edit takes the existing local-first path: IndexedDB mirror
(`saveLocal`/`softDeleteLocal`) → dirty marker → `pushLocal`. Full editing
therefore works offline from day one.

Touch points:

- `pushChanges` in `src/lib/sync/actions.ts`, `lists` branch: validate and persist
  the new column (trim, max 120 chars, empty → `null`) in both `values` and the
  `onConflictDoUpdate` set.
- `pullChanges` uses `select()` — picks the column up automatically.
- `SyncRow`/`SyncPayload` derive from the Drizzle row types — automatic.
- IndexedDB: no `DB_VERSION` bump (no new object stores). Old mirrored rows lack
  the field → `undefined` is treated as `null`; the next pull refreshes them.

## Edge cases

- Deleting a store from the catalog: lists are unaffected (text snapshot); sets
  behave as today (`nullStoreReferences`).
- Changing the list's default store re-points only inheriting items; overrides stay.
- Cross-device conflicts: per-row last-write-wins, unchanged.
- Length limits consistent with existing sync validation: list name ≤ 120,
  store name ≤ 120, item name ≤ 120.
- Empty quick-list name in the dialog falls back to the default ("Szybkie zakupy").

## Out of scope (deliberately)

- "Save list as set" (promote a quick list to a reusable template) — easy to add
  later if a quick list turns out to be recurring; not needed now.
- Hidden/implicit sets backing quick lists — rejected: would pollute the set
  catalog for no benefit. A quick list is just a list that starts empty.
- Retiring the stamped `storeName` on existing list items — old data renders
  correctly as-is; no backfill.

## Verification

No test runner is configured; verify manually in the browser:

1. Quick list end-to-end: create from `/lists` with a store → add products in edit
   mode → check off in shopping view → "Zakończ zakupy".
2. List from a set containing `@store` overrides: list default = set default,
   overrides preserved per item.
3. Change the list's store in edit mode → all inheriting items regroup; overridden
   items stay put.
4. Edit while offline ("Symulacja offline" toggle) → go online → changes sync;
   second device converges (LWW).
5. Legacy lists (created before the change) render unchanged.
