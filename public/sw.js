const CACHE_NAME = "plant-speaks-pwa-v8";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/main-plant.png",
  "/icons/pwa-icon-192.png",
  "/icons/pwa-icon-512.png",
  "/icons/plant-logo.png",
  "/icons/home.png",
  "/icons/observe.png",
  "/icons/care.png",
  "/icons/record.png",
  "/icons/camera.png",
  "/icons/leaf.png",
  "/icons/soil.png",
  "/icons/water.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;
  if (requestUrl.pathname.startsWith("/src/")) return;
  if (requestUrl.pathname.startsWith("/@")) return;
  if (requestUrl.pathname.includes("node_modules")) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseCopy = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }

        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          if (event.request.mode === "navigate") {
            return caches.match("/");
          }

          return Response.error();
        })
      )
  );
});
