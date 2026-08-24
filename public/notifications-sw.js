/* BTR notification worker — notifications only, no caching, no fetch handler. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
