// Opprydder v1.1.1
// Fram til v1.0.1 lå spilleren i rotmappa med en service worker her.
// Den gamle kopien viste fortsatt v1.0.1. Denne filen erstatter den,
// sletter den gamle lagrede kopien, melder seg selv ut og laster siden på nytt.
// Spilleren har nå sin egen service worker i app/.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key === "lopespiller-1.0.0" || key === "lopespiller-1.0.1") await caches.delete(key);
    }
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) c.navigate(c.url);
  })());
});
