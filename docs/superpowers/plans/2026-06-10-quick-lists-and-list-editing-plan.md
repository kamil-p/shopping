# Quick Lists & Full List Editing — Implementation Plan

Spec: `docs/superpowers/specs/2026-06-10-quick-lists-and-list-editing-design.md`

## Steps

1. **Schema** — add `storeName: text("store_name")` (nullable) to `lists` in
   `src/db/schema.ts`; `pnpm db:generate` + `pnpm db:migrate`.

2. **Sync server** — `pushChanges` `lists` branch in `src/lib/sync/actions.ts`:
   parse `storeName` (trim, slice 120, empty → null), include in `values` and
   `onConflictDoUpdate.set`. Pull/types pick the column up automatically.

3. **Copy semantics** — `src/lib/offline/make-list.ts`, `createListFromMirror`:
   - `lists.storeName` ← resolved set default store name;
   - `list_items.storeName` ← override name only when the set item had
     `storeId`; otherwise `null` (inherits). Missing store in catalog → `null`.

4. **Quick list creation** — new `createQuickList(userId, name, storeName)` in
   `make-list.ts` (list row with `setId: null`, no items, `pushLocal`).
   New `NewListDialog` (bottom Sheet, modeled on `MakeListDialog`): name input
   defaulting to "Szybkie zakupy" + optional store chips from the mirror's
   catalog. Button "Nowa lista" in the `/lists` page header. On success
   `router.push(/lists/<id>?edit=1)`.

5. **Generalize `ProductRow`** — make the row domain-neutral (name, store tag
   text, store radio value/options, inherit label, callbacks); `SetEditor` maps
   `SetItem`/storeId, the list editor maps `ListItem`/storeName. UX unchanged.

6. **List edit mode** — extend `useOfflineListSync` to track the `list` row and
   expose list-level persistence (rename, set default store) plus item edits
   (rename, store override, delete, reorder — `(i+1)*10` renumber scheme).
   New `ListEditView` modeled on `SetEditor`: inline name, "Domyślny sklep"
   chip + reused `DefaultStorePicker` (parent maps store id ↔ text name,
   `onCreate` adds to the catalog via the mirror), generalized product rows,
   quick-add. "Gotowe" exits.

7. **Shopping view** — `ListView`: grouping key `item.storeName ??
   list.storeName ?? "Bez sklepu"`; "Edytuj" button toggles the edit view;
   initial edit state read once from `?edit=1`.

8. **Docs & version** — refresh the shopping-domain paragraph in `CLAUDE.md`
   (list default store, quick lists); bump version 0.2.2 → 0.3.0.

9. **Verify** — `pnpm lint` + browser walkthrough per the spec's verification
   list (quick list E2E, set with `@store` overrides, list-store re-pointing,
   offline simulation, legacy lists).
