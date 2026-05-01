// MB QR Pay — Service Worker
// Caches all app assets so it works 100% offline after first load

const CACHE_NAME = "mb-qr-v1";

const ASSETS = [
  "./index.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
];

// Install: cache all assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets immediately; external ones best-effort
      return cache.addAll(["./index.html", "./manifest.json"])
        .then(() => {
          // Try to cache external assets (fonts, qrcode lib) — fail silently
          return Promise.allSettled(
            ["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"].map(url =>
              fetch(url).then(res => cache.put(url, res)).catch(() => {})
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app assets, network-first for everything else
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Always bypass for WhatsApp / external navigation
  if (event.request.mode === "navigate" && url.hostname !== self.location.hostname) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
