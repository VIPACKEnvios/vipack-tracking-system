"use client";

import {
  useEffect,
  useState,
} from "react";

type Props = {
  token: string;
};

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 -
        (base64String.length %
          4)) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let i = 0;
    i < rawData.length;
    i++
  ) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}


function obtenerMensajeErrorPush(error: unknown) {
  if (!(error instanceof Error)) {
    return "No se pudieron activar las notificaciones.";
  }

  const nombre = error.name;
  const detalle = error.message || "";

  if (nombre === "NotAllowedError") {
    return "Las notificaciones están bloqueadas en este navegador. Abre los permisos de vipack-envios.com y permite Notificaciones.";
  }

  if (nombre === "AbortError") {
    return "El navegador no pudo completar el registro de notificaciones. Cierra esta página, vuelve a abrirla e inténtalo otra vez.";
  }

  if (nombre === "InvalidStateError") {
    return "El navegador tiene una suscripción de notificaciones dañada. Recarga la página e inténtalo nuevamente.";
  }

  if (
    nombre === "InvalidCharacterError" ||
    nombre === "DataError"
  ) {
    return "La configuración de notificaciones de VIPACK no es válida. Revisa la llave VAPID pública.";
  }

  if (detalle.toLowerCase().includes("service worker")) {
    return "No se pudo iniciar el servicio de notificaciones en este navegador. Recarga la página e inténtalo nuevamente.";
  }

  if (detalle.toLowerCase().includes("push service")) {
    return "El servicio de notificaciones del teléfono no está disponible en este momento. Inténtalo nuevamente.";
  }

  return detalle
    ? `No se pudieron activar las notificaciones: ${detalle}`
    : "No se pudieron activar las notificaciones.";
}


export default function EnablePushNotifications({
  token,
}: Props) {
  const [
    soportado,
    setSoportado,
  ] = useState(true);

  const [
    permiso,
    setPermiso,
  ] =
    useState<NotificationPermission>(
      "default"
    );

  const [
    activado,
    setActivado,
  ] = useState(false);

  const [
    verificando,
    setVerificando,
  ] = useState(true);

  const [
    cargando,
    setCargando,
  ] = useState(false);

  const [
    mensaje,
    setMensaje,
  ] = useState("");

  useEffect(() => {
    let cancelado = false;

    const revisar =
      async () => {
        const compatible =
          typeof window !==
            "undefined" &&
          "serviceWorker" in
            navigator &&
          "PushManager" in
            window &&
          "Notification" in
            window;

        if (
          cancelado
        ) {
          return;
        }

        setSoportado(
          compatible
        );

        if (
          !compatible
        ) {
          setVerificando(
            false
          );
          return;
        }

        const permisoActual =
          Notification.permission;

        setPermiso(
          permisoActual
        );

        try {
          const registration =
            await navigator.serviceWorker.register(
              "/sw.js"
            );

          await navigator
            .serviceWorker
            .ready;

          const subscription =
            await registration
              .pushManager
              .getSubscription();

          /*
           * Chrome puede tener una
           * suscripción del dominio,
           * pero eso NO significa que
           * pertenezca a este cliente.
           */
          if (
            !subscription
          ) {
            if (
              !cancelado
            ) {
              setActivado(
                false
              );
            }

            return;
          }

          const endpoint =
            subscription
              .endpoint;

          const response =
            await fetch(
              `/api/inventario/${encodeURIComponent(
                token
              )}/push/subscribe?endpoint=${encodeURIComponent(
                endpoint
              )}`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              }
            );

          const result =
            await response.json();

          if (
            cancelado
          ) {
            return;
          }

          setActivado(
            response.ok &&
              result?.success ===
                true &&
              result?.activado ===
                true
          );
        } catch (
          error
        ) {
          console.error(
            "Error verificando notificaciones push:",
            error
          );

          if (
            !cancelado
          ) {
            setActivado(
              false
            );
          }
        } finally {
          if (
            !cancelado
          ) {
            setVerificando(
              false
            );
          }
        }
      };

    if (token) {
      revisar();
    } else {
      setVerificando(
        false
      );
    }

    return () => {
      cancelado = true;
    };
  }, [token]);

  const activarNotificaciones =
    async () => {
      if (!soportado) {
        setMensaje(
          "Este navegador no admite notificaciones push."
        );
        return;
      }

      if (!token) {
        setMensaje(
          "No se encontró el acceso del cliente."
        );
        return;
      }

      const vapidPublicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        setMensaje(
          "Falta configurar la llave pública de notificaciones."
        );
        return;
      }

      try {
        setCargando(true);
        setMensaje("");

        if (
          Notification.permission ===
          "denied"
        ) {
          setPermiso("denied");
          setActivado(false);
          setMensaje(
            "Las notificaciones están bloqueadas en este navegador. Abre los permisos de vipack-envios.com y permite Notificaciones."
          );
          return;
        }

        const permission =
          await Notification.requestPermission();

        setPermiso(permission);

        if (
          permission !== "granted"
        ) {
          setActivado(false);
          setMensaje(
            "Debes permitir las notificaciones para activarlas."
          );
          return;
        }

        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              updateViaCache: "none",
            }
          );

        await navigator
          .serviceWorker
          .ready;

        let subscription =
          await registration
            .pushManager
            .getSubscription();

        if (!subscription) {
          try {
            subscription =
              await registration
                .pushManager
                .subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    urlBase64ToUint8Array(
                      vapidPublicKey
                    ),
                });
          } catch (subscribeError) {
            console.error(
              "Primer intento de suscripción push falló:",
              subscribeError
            );

            const existente =
              await registration
                .pushManager
                .getSubscription();

            if (existente) {
              try {
                await existente.unsubscribe();
              } catch (unsubscribeError) {
                console.warn(
                  "No se pudo limpiar la suscripción anterior:",
                  unsubscribeError
                );
              }
            }

            subscription =
              await registration
                .pushManager
                .subscribe({
                  userVisibleOnly: true,
                  applicationServerKey:
                    urlBase64ToUint8Array(
                      vapidPublicKey
                    ),
                });
          }
        }

        const response =
          await fetch(
            `/api/inventario/${encodeURIComponent(
              token
            )}/push/subscribe`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                subscription:
                  subscription.toJSON(),
              }),
            }
          );

        let result: any = null;

        try {
          result =
            await response.json();
        } catch {
          result = null;
        }

        if (
          !response.ok ||
          !result?.success
        ) {
          console.error(
            "Error registrando push:",
            {
              status: response.status,
              result,
            }
          );

          setActivado(false);
          setMensaje(
            result?.error ||
              `VIPACK no pudo registrar este dispositivo. Código ${response.status}.`
          );
          return;
        }

        const endpoint =
          subscription.endpoint;

        const verificarResponse =
          await fetch(
            `/api/inventario/${encodeURIComponent(
              token
            )}/push/subscribe?endpoint=${encodeURIComponent(
              endpoint
            )}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const verificarResult =
          await verificarResponse.json();

        if (
          !verificarResponse.ok ||
          verificarResult?.activado !== true
        ) {
          setActivado(false);
          setMensaje(
            verificarResult?.error ||
              "El dispositivo se registró, pero no pudo verificarse. Inténtalo nuevamente."
          );
          return;
        }

        setActivado(true);
        setMensaje(
          "Notificaciones activadas correctamente."
        );
      } catch (error) {
        console.error(
          "Error activando notificaciones:",
          error
        );

        setActivado(false);
        setMensaje(
          obtenerMensajeErrorPush(error)
        );
      } finally {
        setCargando(false);
      }
    };

  if (
    !soportado
  ) {
    return null;
  }

  if (
    verificando
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">
            🔔
          </div>

          <div>
            <p className="text-sm font-black text-slate-700">
              Verificando notificaciones...
            </p>

            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              Comprobando este dispositivo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    activado &&
    permiso ===
      "granted"
  ) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl">
            🔔
          </div>

          <div>
            <p className="text-sm font-black text-emerald-800">
              Notificaciones activadas
            </p>

            <p className="mt-0.5 text-xs font-semibold text-emerald-600">
              VIPACK puede avisarte cuando llegue mercancía nueva.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
          🔔
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">
            Activa tus notificaciones
          </p>

          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
            Recibe un aviso en tu celular cuando VIPACK agregue nueva mercancía a tu inventario.
          </p>

          <button
            type="button"
            onClick={
              activarNotificaciones
            }
            disabled={
              cargando
            }
            className="mt-3 rounded-xl bg-[#0a3183] px-4 py-2 text-xs font-black text-white shadow transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando
              ? "Activando..."
              : "Activar notificaciones"}
          </button>

          {mensaje && (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {mensaje}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}