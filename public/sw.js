/* Hand-rolled service worker for the "Zakupy" PWA offline support (v2).
 *
 * The list views are local-first: they render from the IndexedDB mirror, so the
 * SW only has to make the app *shell* boot offline and never block.
 *
 * Strategy:
 *  - /_next/static/* (content-hashed) → cache-first.
 *  - script/style/font/image → stale-while-revalidate.
 *  - RSC data fetches (?_rsc) → when offline, fail FAST so Next falls back to a
 *    hard navigation instead of hanging ~30s on a dead request.
 *  - page navigations:
 *      offline → serve cached doc immediately (no network wait). For an
 *                un-warmed /lists/<id>, reuse any cached detail shell (the page
 *                reads its id from the URL and loads data from the mirror).
 *                Last resort: the cached /lists shell.
 *      online  → network-first, but bounded by a 2.5s timeout so a flaky link
 *                can't stall the UI; fall back to cache on failure/timeout.
 *  - non-GET (Server Action POSTs) → ignored.
 *  - message {type:"warm", urls} → precache those route docs (so even lists not
 *    opened this session work offline).
 *
 * Bump VERSION to invalidate the old cache.
 */
const VERSION = "v4";
const CACHE = `zakupy-${VERSION}`;
const APP_FALLBACK = "/lists";
const NAV_TIMEOUT = 2500;
// Detail routes whose client reads its id from the URL — any cached shell of the
// same kind boots an un-warmed one offline.
const DETAIL_RES = [/^\/lists\/[^/]+$/, /^\/sets\/[^/]+$/];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(
          data.urls.map((url) => cache.add(url).catch(() => {})),
        );
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // leave Server Action POSTs alone

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // RSC payload fetches: offline, reject immediately so Next hard-navigates fast.
  const isRsc =
    url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
  if (isRsc) {
    if (!self.navigator.onLine) event.respondWith(Response.error());
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request, url));
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function navigationHandler(request, url) {
  const cache = await caches.open(CACHE);

  // Offline: never touch the network (this is what removes the ~30s hang).
  if (!self.navigator.onLine) return serveFromCache(cache, request, url);

  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return serveFromCache(cache, request, url);
  }
}

async function serveFromCache(cache, request, url) {
  const exact = await cache.match(request, { ignoreVary: true });
  if (exact) return exact;

  // Un-warmed detail (list or set) → reuse any cached shell of the same kind
  // (the client reads the id from the URL and loads from the mirror).
  const detail = DETAIL_RES.find((re) => re.test(url.pathname));
  if (detail) {
    const keys = await cache.keys();
    const shell = keys.find((req) => detail.test(new URL(req.url).pathname));
    if (shell) {
      const r = await cache.match(shell, { ignoreVary: true });
      if (r) return r;
    }
  }

  const fallback = await cache.match(APP_FALLBACK, { ignoreVary: true });
  return fallback || offlineResponse();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
