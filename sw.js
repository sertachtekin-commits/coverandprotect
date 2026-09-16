/* Cover & Protect service worker.
 * Registered from app.html, buy-online.html and travel-insurance-calculator.html
 * (scope "/") so the buy-online app, the hub and the calculator work offline
 * once visited. Navigations are network-first, with a short timeout after which
 * the cached page wins; the cached app page is the offline fallback. Only
 * same-origin GET requests are ever cached — Formspree posts, insurer checkout
 * portals, analytics and fonts pass straight through to the network.
 * Bump CACHE_VERSION when precached assets change. */
var CACHE_VERSION = "cp-pwa-v12";
var PRECACHE = [
  "/app.html",
  "/buy-online.html",
  "/instant-quote.html",
  "/travel-insurance-calculator.html",
  "/travel-landing.css",
  "/tracking.js?v=11",
  "/manifest.json",
  "/images/icon-192.png",
  "/images/icon-512.png",
  "/images/icon-maskable-512.png",
  "/images/apple-touch-icon.png"
];
var OFFLINE_FALLBACK = "/app.html";
/* How long a navigation waits for the network before the cached page is served
 * instead. Someone one tap from a checkout on a weak mobile connection is
 * better served a slightly stale page than a spinner; the network copy still
 * refreshes the cache when it eventually arrives. */
var NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // Cached one at a time: addAll rejects the whole install if a single URL
      // fails, which would leave the app with no offline support at all.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url)["catch"](function () {});
      }));
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
    // Network-first so a fresh deploy shows immediately, but not indefinitely:
    // after NAVIGATION_TIMEOUT_MS the cached page wins the race. If nothing is
    // cached yet the network request is still what resolves, however long it
    // takes, so a first visit is never cut short.
    event.respondWith(new Promise(function (resolve) {
      var settled = false;

      function settle(response) {
        if (settled || !response) { return; }
        settled = true;
        resolve(response);
      }

      function cachedOrFallback() {
        return caches.match(request).then(function (cached) {
          return cached || caches.match(OFFLINE_FALLBACK);
        });
      }

      var timer = setTimeout(function () {
        if (settled) { return; }
        cachedOrFallback().then(settle);
      }, NAVIGATION_TIMEOUT_MS);

      fetch(request).then(function (response) {
        clearTimeout(timer);
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        settle(response);
      })["catch"](function () {
        clearTimeout(timer);
        cachedOrFallback().then(function (cached) {
          settle(cached || Response.error());
        });
      });
    }));
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
