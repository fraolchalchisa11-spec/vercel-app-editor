import { useCallback, useEffect, useRef, useState } from "react";

const SHOWN_KEY = "btr-shown-notification-ids";

function readShown() {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeShown(ids) {
  try {
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* ignore */
  }
}

function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function showOne({ title, body, tag }) {
  const options = {
    body,
    tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/" },
  };
  // Prefer the service worker so Android shows the notification even when the
  // app is in the background / not the foreground tab.
  try {
    if ("serviceWorker" in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration("/notifications-sw.js")) ||
        (await navigator.serviceWorker.register("/notifications-sw.js"));
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    /* fall through to the page-level notification */
  }

  try {
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

/**
 * Mirrors in-app notifications to real device notifications.
 * `items` = [{ id, title, body }]
 */
export function useDeviceNotifications(items, enabled = true) {
  const [permission, setPermission] = useState(() => (supported() ? Notification.permission : "unsupported"));
  const shownRef = useRef(null);

  const requestPermission = useCallback(async () => {
    if (!supported()) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return Notification.permission;
    }
  }, []);

  // Ask once, on first load, when the student hasn't decided yet.
  useEffect(() => {
    if (!enabled || !supported()) return;
    if (Notification.permission === "default") {
      const timer = setTimeout(() => {
        requestPermission();
      }, 2500);
      return () => clearTimeout(timer);
    }
    setPermission(Notification.permission);
  }, [enabled, requestPermission]);

  useEffect(() => {
    if (!enabled || !supported() || permission !== "granted") return;
    if (!Array.isArray(items) || items.length === 0) return;
    if (shownRef.current === null) shownRef.current = readShown();

    const fresh = items.filter((n) => n && n.id && !shownRef.current.includes(n.id));
    if (fresh.length === 0) return;

    shownRef.current = [...shownRef.current, ...fresh.map((n) => n.id)];
    writeShown(shownRef.current);

    fresh.slice(0, 3).forEach((n) => {
      showOne({ title: n.title || "BTR ትምህርት", body: n.body || "", tag: n.id });
    });
  }, [items, permission, enabled]);

  return { permission, requestPermission, supported: supported() };
}
