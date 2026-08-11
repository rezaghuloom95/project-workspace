const CACHE_VERSION = "project-workspace-v1";
const APP_ROOT = new URL(self.registration.scope);
const APP_PATH = APP_ROOT.pathname.replace(/\/$/, "");
const APP_SHELL = [APP_ROOT.href, new URL("manifest.webmanifest", APP_ROOT).href];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(`${APP_PATH}/api/`)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(APP_ROOT.href)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && ["style", "script", "font", "image"].includes(request.destination)) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Project Workspace",
    message: "Your club plan has an update.",
    url: "/",
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Use the safe default notification.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.message,
      icon: new URL("icon-192.png", APP_ROOT).href,
      badge: new URL("icon-192.png", APP_ROOT).href,
      data: { url: payload.url },
      tag: payload.tag || payload.url,
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = String(event.notification.data?.url || "./").replace(/^\/+/, "");
  const target = new URL(destination, APP_ROOT).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(self.location.origin));
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
