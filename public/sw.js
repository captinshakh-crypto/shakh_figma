const CACHE = "shakh-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "شاخ";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "ئاگادارییەکی نوێت هەیە",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: typeof payload.tag === "string"
      ? payload.tag
      : (typeof payload.notification_id === "string" ? "shakh-" + payload.notification_id : "shakh-notification"),
    renotify: true,
    data: {
      url: typeof payload.url === "string" ? payload.url : "/",
      notificationId: typeof payload.notification_id === "string" ? payload.notification_id : null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    typeof event.notification.data?.url === "string" ? event.notification.data.url : "/",
    self.location.origin
  );
  if (target.origin !== self.location.origin) target.href = self.location.origin + "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
