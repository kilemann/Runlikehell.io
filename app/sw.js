// Lommespiller service worker – gjør appen tilgjengelig uten nett.
// Bytt versjonsnummeret ved hver ny versjon, så hentes de nye filene.
const VERSION = "1.5.0";
const CACHE = "lopespiller-" + VERSION;   // prefiks beholdt fra før navnebyttet
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lopespiller-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lokalt først: appen startes alltid fra lagret kopi, uten nettrafikk.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./index.html").then((r) => r || fetch(req));
      return fetch(req);
    })
  );
});
