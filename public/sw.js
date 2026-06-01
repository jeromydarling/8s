// 8 Seconds service worker — installable + offline shell.
// Static assets: cache-first. Navigations: network-first w/ offline fallback.
// API: never cached (always fresh).
const CACHE = "eight-v1";
const SHELL = ["/", "/app", "/manifest.webmanifest", "/icon.svg", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Never cache the API.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/app") || caches.match("/"))),
    );
    return;
  }

  // Static assets: cache-first, then network (and cache it).
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js"))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
