/* Cover & Protect service worker.
 * Registered from travel-insurance-calculator.html (scope "/") so the
 * calculator works offline once visited. Navigations are network-first so
 * fresh deploys show immediately; the cached calculator page is the offline
 * fallback. Only same-origin GET requests are ever cached — Formspree posts,
 * analytics and fonts pass straight through to the network.
 * Bump CACHE_VERSION when precached assets change. */
var CACHE_VERSION = "cp-pwa-v4";
var PRECACHE = [
  "/travel-insurance-calculator.html",
  "/tracking.js?v=5",
  "/manifest.json",
  "/images/icon-192.png",
  "/images/icon-512.png"
];
var OFFLINE_FALLBACK = "/travel-insurance-calculator.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_VERSION) { return caches.delete(key); }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") { return; }
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) { return; }

  if (request.mode === "navigate") {
    // Network-first: live site stays authoritative, cache is the fallback.
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match(OFFLINE_FALLBACK);
        });
      })
    );
    return;
  }

  // Static assets: cache-first with background refresh.
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
