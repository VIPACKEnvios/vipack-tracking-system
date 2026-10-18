
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

      if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload)
      ) {
        data = {
          ...data,
          ...payload,
        };
      }
    } catch {
      try {
        data.body = event.data.text();
      } catch (error) {
        console.error(
          "VIPACK: error leyendo notificación:",
          error
        );
      }
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
    (async function () {
      // Mostrar la notificación normalmente.
      await self.registration.showNotification(
        data.title || "VIPACK Envíos",
        options
      );

      // Las notificaciones normales no requieren
      // confirmación de diagnóstico.
      const entregaId = data.entrega_id;
      const confirmacionToken = data.confirmacion_token;

      if (
        typeof entregaId !== "string" ||
        typeof confirmacionToken !== "string"
      ) {
        return;
      }

      // Confirmar que el navegador procesó
      // correctamente la notificación.
      try {
        const response = await fetch(
          "/api/push/confirmar-recepcion",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              entrega_id: entregaId,
              confirmacion_token: confirmacionToken,
            }),
            cache: "no-store",
            credentials: "omit",
          }
        );

        if (!response.ok) {
          console.warn(
            "VIPACK: confirmación pendiente:",
            response.status
          );
        }
      } catch (error) {
        console.error(
          "VIPACK: no se pudo confirmar recepción:",
          error
        );
      }
    })()
  );
});

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const url =
      event.notification?.data?.url || "/";

    event.waitUntil(
      (async function () {
        const destino = new URL(
          url,
          self.location.origin
        );

        // Evitar abrir destinos externos.
        if (destino.origin !== self.location.origin) {
          return;
        }

        const clientList = await clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        for (const client of clientList) {
          if ("focus" in client) {
            await client.navigate(destino.href);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(destino.href);
        }
      })()
    );
  }
);
