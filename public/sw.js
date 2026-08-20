self.addEventListener("push", function (event) {
  let data = {
    title: "VIPACK Envíos",
    body: "Tienes una nueva notificación.",
    url: "/",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };

  if (event.data) {
    try {
      const payload = event.data.json();

      data = {
        ...data,
        ...payload,
      };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: {
      url: data.url || "/",
    },
    vibrate: [200, 100, 200],
    tag: data.tag || "vipack-notificacion",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "VIPACK Envíos",
      options
    )
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url =
    event.notification?.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});