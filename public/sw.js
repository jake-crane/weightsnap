// WeightSnap service worker: lets the installed app open without a
// connection by keeping a copy of the dashboard and the files it needs.
//
// - /dashboard opens instantly from its saved copy when there is one, so the
//   app is usable while the network or a cold server catches up. A fresh copy
//   is fetched in the background and saved for next time, and the page
//   refreshes its own data once the server answers (see offline-provider).
// - Other page loads go to the network first. With no network (or none
//   within NETWORK_TIMEOUT_MS), they open the saved dashboard instead.
// - Build files under /_next/static/ are content-hashed and never change, so
//   they are served from the cache when present.
// - Everything else (API calls, Server Actions, RSC requests) is left alone.

const PAGE_CACHE = "weightsnap-pages"; // also in src/lib/offline-cache.ts
const STATIC_CACHE = "weightsnap-static";
const OFFLINE_PAGE = "/dashboard";
const NETWORK_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 300;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGE_CACHE, STATIC_CACHE];
      for (const name of await caches.keys()) {
        if (!keep.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, url));
  }
});

// The page asks for a fresh offline copy after its data changes.
self.addEventListener("message", (event) => {
  if (event.data?.type === "cache-page" && event.data.path === OFFLINE_PAGE) {
    event.waitUntil(
      fetch(OFFLINE_PAGE, { redirect: "manual" })
        .then((response) => savePage(response))
        .catch(() => {}),
    );
  }
});

// Matched on URL alone: script requests carry an Origin header, and a server
// that sends Vary: Origin would otherwise never match the saved copy.
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await putStatic(cache, request.url, response.clone());
  return response;
}

async function handleNavigation(event, url) {
  const isOfflinePage = url.pathname === OFFLINE_PAGE;
  const network = fetch(event.request);
  // Whenever the network answers, even after we've replied from the cache,
  // keep the dashboard's saved copy current (or drop it if signed out).
  const saving = network
    .then((response) => (isOfflinePage ? savePage(response.clone()) : undefined))
    .catch(() => {});
  event.waitUntil(saving);

  const saved = await caches
    .open(PAGE_CACHE)
    .then((cache) => cache.match(OFFLINE_PAGE, { ignoreVary: true }));

  // Stale-while-revalidate for the dashboard itself.
  if (saved && isOfflinePage) return saved;

  let response;
  try {
    response = saved
      ? await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)])
      : await network;
  } catch {
    response = undefined;
  }

  if (response) return response;

  // Offline (or too slow). Open the saved dashboard if there is one.
  if (saved) {
    return url.pathname === OFFLINE_PAGE
      ? saved
      : Response.redirect(new URL(OFFLINE_PAGE, self.location.origin).href, 302);
  }
  return offlineFallback();
}

async function savePage(response) {
  const cache = await caches.open(PAGE_CACHE);
  // A redirect means the user is signed out: drop their saved data.
  if (response.type === "opaqueredirect" || response.redirected) {
    await cache.delete(OFFLINE_PAGE);
    return;
  }
  if (!response.ok || response.type !== "basic") return;

  const html = await response.clone().text();
  await cacheAssets(html);
  await cache.put(OFFLINE_PAGE, response);
}

// Save the scripts, styles and fonts the page references so it can render
// offline, including on the first visit before the worker was in control.
async function cacheAssets(html) {
  const urls = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? []);
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...urls].map(async (path) => {
      const url = new URL(path, self.location.origin).href;
      if (await cache.match(url, { ignoreVary: true })) return;
      try {
        const response = await fetch(url);
        if (response.ok) await putStatic(cache, url, response);
      } catch {
        // Picked up next time.
      }
    }),
  );
}

async function putStatic(cache, url, response) {
  await cache.put(url, response);
  // Old builds' files pile up across deploys. Drop the oldest.
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) {
    await cache.delete(key);
  }
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

function offlineFallback() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WeightSnap</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: -apple-system, system-ui, sans-serif; background: #f9f9f7; color: #0b0b0b; padding: 0 16px; text-align: center; }
  @media (prefers-color-scheme: dark) { body { background: #0d0d0d; color: #fff; } }
  p { color: #898781; font-size: 14px; }
  button { font: inherit; font-size: 14px; padding: 8px 16px; border-radius: 6px; border: 1px solid #8884; background: none; color: inherit; cursor: pointer; }
</style>
</head>
<body>
  <div>
    <h1 style="font-size: 20px; font-weight: 600">You're offline</h1>
    <p>Connect to the internet and sign in once. After that, WeightSnap opens without a connection.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
