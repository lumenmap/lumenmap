/* LumenMap Service Worker */
const CACHE_NAME = "lumenmap-shell-v1";
const DATA_CACHE_NAME = "lumenmap-data-v1";
const MAX_ACTIVITY_CACHE_ENTRIES = 20;

// Essential app shell assets to precache
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache failed partially:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      await trimCache(cacheName, maxItems);
    }
  } catch (e) {
    // ignore trim errors
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Handle activity API requests: network first with fallback to cache, bounded size
  if (url.pathname.startsWith("/api/activity") || url.pathname.startsWith("/api/v1/activity")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              trimCache(DATA_CACHE_NAME, MAX_ACTIVITY_CACHE_ENTRIES);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) {
            // Add custom header so consumer know it was served from SW cache
            const headers = new Headers(cached.headers);
            headers.set("X-LumenMap-Offline-Cache", "true");
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: headers,
            });
          }
          return new Response(
            JSON.stringify({ error: "Offline and no cached data available" }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        })
    );
    return;
  }

  // For navigation (HTML pages) and static assets: stale-while-revalidate / network-first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          const matched = await caches.match(event.request);
          if (matched) return matched;
          const fallback = await caches.match("/");
          if (fallback) return fallback;
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        })
    );
    return;
  }

  // Shell assets (JS, CSS, static images): Cache first or Network first with cache fallback
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/") ||
     url.pathname.endsWith(".js") ||
     url.pathname.endsWith(".css") ||
     url.pathname.endsWith(".png") ||
     url.pathname.endsWith(".ico") ||
     url.pathname.endsWith(".svg") ||
     url.pathname.endsWith(".json"))
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, copy);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }
});
