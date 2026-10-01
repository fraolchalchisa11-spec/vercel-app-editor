/* BTR worker — v2
   1) Offline support: the app itself (page + scripts + styles + images from
      this site) is saved on the device, so it can open with no internet.
      When there's no connection, the app's "You're offline" screen shows.
      If the app was never opened online on this device, /offline.html shows.
   2) Notifications (unchanged).
   Data requests (login, students, notes, etc.) are never cached. */
const CACHE = "btr-app-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch("/", { cache: "reload" });
        if (res && res.ok && !res.redirected) await cache.put("/", res);
      } catch {
        /* ignore */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("btr-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

// Page loads: online → always the fresh page (and save a copy).
// Offline → the saved page, so the app opens; last resort → offline.html.
async function handleNavigate(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic" && !res.redirected) {
      cache.put(req, res.clone()).catch(() => {});
      cache.put("/", res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const hit = (await cache.match(req)) || (await cache.match("/")) || (await cache.match(OFFLINE_URL));
    return (
      hit ||
      new Response("You're offline. Please connect to the internet and try again.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

// Scripts, styles, fonts, images: use the saved copy right away and quietly
// refresh it in the background.
async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("_online_check")) return;

  if (req.mode === "navigate") {
    event.respondWith(handleNavigate(req));
    return;
  }
  if (["script", "style", "font", "image"].includes(req.destination) || url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(req, event));
  }
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
