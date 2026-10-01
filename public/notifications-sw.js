/* BTR worker — notifications + offline fallback page.
   It does NOT cache app data or assets; the only thing it saves is
   /offline.html, which it shows when a page load fails with no internet. */
const OFFLINE_CACHE = "btr-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* ignore: the worker still installs, it just has no fallback page */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Remove old offline caches from earlier versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("btr-offline-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);

// Only page loads (navigations) are handled. Everything else goes straight
// to the network exactly as before.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ||
          new Response("You're offline. Please connect to the internet and try again.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Future-ready: if a push service is wired up later, show its payload.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BTR ትምህርት", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "BTR ትምህርት", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});
