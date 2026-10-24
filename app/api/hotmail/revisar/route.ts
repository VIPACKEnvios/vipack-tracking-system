
import { NextRequest, NextResponse } from "next/server";

import { verificarAccesoHotmail } from "@/lib/vipack-cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cifrarToken, descifrarToken } from "@/lib/hotmail/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMITENTE = "infoexpress@paquetexpress.com.mx";
const MAX_PAGINAS = 20;
const TAMANO_PAGINA = 50;

type Cuenta = {
  id: number;
  correo: string;
  access_token_cifrado: string;
  refresh_token_cifrado: string;
  token_expira_en: string;
};

type MensajeGraph = {
  id: string;
  subject?: string | null;
  receivedDateTime?: string | null;
  from?: {
    emailAddress?: {
      address?: string | null;
    };
  };
  body?: {
    contentType?: string;
    content?: string;
  };
  bodyPreview?: string | null;
};

type Envio = {
  id: number;
  guia: string | null;
  paqueteria: string | null;
  estatus_actual: string | null;
  estado_manual_bloqueado: boolean | null;
  entregado: boolean | null;
};

type Evento =
  | "recoleccion"
  | "comienzo_viaje"
  | "no_identificado";

type ResultadoEvento = {
  guia: string | null;
  envio_id: number | null;
  evento: Evento;
  fecha: string | null;
  resultado: string;
  mensaje_id: string;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectarEvento(asunto: string): Evento {
  const texto = normalizar(asunto);

  if (
    texto.includes("recoleccion realizada correctamente")
  ) {
    return "recoleccion";
  }

  if (texto.includes("comienzo del viaje")) {
    return "comienzo_viaje";
  }

  return "no_identificado";
}

function limpiarHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, numero: string) =>
      String.fromCharCode(Number(numero))
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extraerGuias(texto: string): string[] {
  const encontradas =
    texto.match(/(?<!\d)\d{12}(?!\d)/g) || [];

  return [...new Set(encontradas)];
}

function esPaquetexpress(
  paqueteria: string | null
): boolean {
  return (
    normalizar(paqueteria || "")
      .replace(/[^a-z]/g, "") === "paquetexpress"
  );
}

function estaEntregado(
  estado: string | null
): boolean {
  return normalizar(estado || "").includes("entregado");
}

async function renovarToken(refreshToken: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Configuraci├│n Microsoft incompleta."
    );
  }

  const parametros = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope:
      "openid profile email offline_access User.Read Mail.Read",
  });

  const respuesta = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: parametros.toString(),
      cache: "no-store",
    }
  );

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo renovar el acceso Microsoft."
    );
  }

  const datos: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } = await respuesta.json();

  if (!datos.access_token) {
    throw new Error(
      "Microsoft no devolvi├│ un token."
    );
  }

  return {
    accessToken: datos.access_token,
    refreshToken:
      datos.refresh_token || refreshToken,
    expiresIn: datos.expires_in || 3600,
  };
}

async function obtenerToken(
  cuenta: Cuenta
): Promise<string> {
  const expiracion = new Date(
    cuenta.token_expira_en
  ).getTime();

  if (
    Number.isFinite(expiracion) &&
    expiracion > Date.now() + 60_000
  ) {
    return descifrarToken(
      cuenta.access_token_cifrado
    );
  }

  const tokens = await renovarToken(
    descifrarToken(
      cuenta.refresh_token_cifrado
    )
  );

  const nuevaExpiracion = new Date(
    Date.now() +
      Math.max(60, tokens.expiresIn - 300) * 1000
  ).toISOString();

  const { error } = await getSupabaseAdmin()
    .from("hotmail_cuentas")
    .update({
      access_token_cifrado: cifrarToken(
        tokens.accessToken
      ),
      refresh_token_cifrado: cifrarToken(
        tokens.refreshToken
      ),
      token_expira_en: nuevaExpiracion,
      fecha_actualizacion:
        new Date().toISOString(),
    })
    .eq("id", cuenta.id);

  if (error) {
    throw new Error(
      "No se pudo guardar el token renovado."
    );
  }

  return tokens.accessToken;
}

async function consultarMensajes(
  token: string,
  fechaInicio: number
): Promise<{
  mensajes: MensajeGraph[];
  paginasConsultadas: number;
  limitePaginasAlcanzado: boolean;
}> {
  const urlInicial = new URL(
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages"
  );

  urlInicial.searchParams.set(
    "$select",
    "id,subject,receivedDateTime,from"
  );

  urlInicial.searchParams.set(
    "$top",
    String(TAMANO_PAGINA)
  );

  urlInicial.searchParams.set(
    "$orderby",
    "receivedDateTime desc"
  );

  let siguienteUrl: string | null =
    urlInicial.toString();

  let paginasConsultadas = 0;
  let llegamosAFechaAnterior = false;

  const mensajes: MensajeGraph[] = [];

  while (
    siguienteUrl &&
    paginasConsultadas < MAX_PAGINAS
  ) {
    const respuesta: Response = await fetch(
      siguienteUrl,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!respuesta.ok) {
      throw new Error(
        `Microsoft Graph respondi├│ ${respuesta.status}.`
      );
    }

    const datos: {
      value?: MensajeGraph[];
      "@odata.nextLink"?: string;
    } = await respuesta.json();

    if (!Array.isArray(datos.value)) {
      throw new Error(
        "Microsoft devolvi├│ una lista de mensajes inv├ílida."
      );
    }

    paginasConsultadas++;

    const pagina = datos.value;

    for (const mensaje of pagina) {
      const fecha = mensaje.receivedDateTime
        ? new Date(
            mensaje.receivedDateTime
          ).getTime()
        : NaN;

      if (!Number.isFinite(fecha)) {
        throw new Error(
          "Se encontr├│ un correo sin fecha v├ílida."
        );
      }

      if (fecha < fechaInicio) {
        llegamosAFechaAnterior = true;
        continue;
      }

      mensajes.push(mensaje);
    }

    if (
      llegamosAFechaAnterior ||
      pagina.length === 0
    ) {
      siguienteUrl = null;
      break;
    }

    const proxima =
      datos["@odata.nextLink"] || null;

    if (proxima) {
      const url = new URL(proxima);

      if (
        url.protocol !== "https:" ||
        url.hostname !== "graph.microsoft.com"
      ) {
        throw new Error(
          "Enlace de paginaci├│n no v├ílido."
        );
      }
    }

    siguienteUrl = proxima;
  }

  return {
    mensajes,
    paginasConsultadas,
    limitePaginasAlcanzado:
      siguienteUrl !== null &&
      paginasConsultadas >= MAX_PAGINAS,
  };
}

async function consultarCuerpo(
  token: string,
  mensajeId: string
): Promise<string> {
  const url = new URL(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
      mensajeId
    )}`
  );

  url.searchParams.set(
    "$select",
    "id,body,bodyPreview"
  );

  const respuesta = await fetch(
    url.toString(),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer:
          'outlook.body-content-type="text"',
      },
      cache: "no-store",
    }
  );

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo leer el mensaje (${respuesta.status}).`
    );
  }

  const mensaje: MensajeGraph =
    await respuesta.json();

  const contenido =
    mensaje.body?.content || "";

  if (
    mensaje.body?.contentType?.toLowerCase() ===
    "html"
  ) {
    return limpiarHtml(contenido);
  }

  return contenido ||
    mensaje.bodyPreview ||
    "";
}

export async function GET(
  request: NextRequest
) {
  if (!verificarAccesoHotmail(request)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Sesi├│n administrativa no autorizada.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const {
      data: configuracion,
      error: errorConfiguracion,
    } = await supabase
      .from("configuracion_paquexpress")
      .select(
        "fecha_inicio, automatizacion_activa, registro_eventos_activo"
      )
      .eq("id", 1)
      .single();

    if (
      errorConfiguracion ||
      !configuracion
    ) {
      throw new Error(
        "No se pudo consultar la configuraci├│n de Paquetexpress."
      );
    }

    const fechaInicio = new Date(
      configuracion.fecha_inicio
    ).getTime();

    if (!Number.isFinite(fechaInicio)) {
      throw new Error(
        "Fecha de inicio no v├ílida."
      );
    }

    const {
      data: cuentas,
      error: errorCuentas,
    } = await supabase
      .from("hotmail_cuentas")
      .select(
        "id, correo, access_token_cifrado, refresh_token_cifrado, token_expira_en"
      )
      .eq("activo", true)
      .order("id");

    if (errorCuentas) {
      throw new Error(
        "No se pudieron consultar las cuentas."
      );
    }

    if (!cuentas || cuentas.length === 0) {
      throw new Error(
        "No hay cuentas Hotmail activas."
      );
    }

    const resultados = [];

    for (const cuenta of cuentas as Cuenta[]) {
      try {
        const token =
          await obtenerToken(cuenta);

        const lectura =
          await consultarMensajes(
            token,
            fechaInicio
          );

        const correosPaquetexpress =
          lectura.mensajes.filter(
            (mensaje) =>
              (
                mensaje.from?.emailAddress
                  ?.address || ""
              )
                .trim()
                .toLowerCase() === REMITENTE
          );

        const eventos: ResultadoEvento[] = [];

        let erroresLectura = 0;

        for (
          const mensaje of correosPaquetexpress
        ) {
          const tipoEvento = detectarEvento(
            mensaje.subject || ""
          );

          if (
            tipoEvento === "no_identificado"
          ) {
            continue;
          }

          const fechaMensaje =
            mensaje.receivedDateTime
              ? new Date(
                  mensaje.receivedDateTime
                ).getTime()
              : NaN;

          if (
            !Number.isFinite(fechaMensaje) ||
            fechaMensaje < fechaInicio
          ) {
            continue;
          }

          try {
            const cuerpo =
              await consultarCuerpo(
                token,
                mensaje.id
              );

            const guias =
              extraerGuias(cuerpo);

            if (guias.length === 0) {
              eventos.push({
                guia: null,
                envio_id: null,
                evento: tipoEvento,
                fecha:
                  mensaje.receivedDateTime ||
                  null,
                resultado:
                  "sin_guia_detectada",
                  mensaje_id: mensaje.id,
              });

              continue;
            }

            for (const guia of guias) {
              const {
                data: envios,
                error: errorEnvios,
              } = await supabase
                .from("envios")
                .select(
                  "id,guia,paqueteria,estatus_actual,estado_manual_bloqueado,entregado"
                )
                .eq("guia", guia)
                .limit(2);

              if (errorEnvios) {
                throw new Error(
                  "Error al buscar la gu├¡a."
                );
              }

              const coincidencias =
                (envios || []) as Envio[];

              const validos =
                coincidencias.filter(
                  (envio) =>
                    esPaquetexpress(
                      envio.paqueteria
                    )
                );

              let resultado =
                "sin_coincidencia";

              let envioId:
                number | null = null;

              if (
                coincidencias.length > 1
              ) {
                resultado =
                  "guia_duplicada";
              } else if (
                validos.length === 1
              ) {
                const envio = validos[0];

                envioId = envio.id;

                if (
                  envio.entregado || estaEntregado(
                    envio.estatus_actual
                  )
                ) {
                  resultado =
                    "omitido_entregado";
                } else if (
                  envio.estado_manual_bloqueado
                ) {
                  resultado =
                    "omitido_bloqueo_manual";
                } else {
                  resultado =
                    "coincidencia_valida";
                }
              }

              eventos.push({
                guia,
                envio_id: envioId,
                evento: tipoEvento,
                fecha:
                  mensaje.receivedDateTime ||
                  null,
                resultado,
                mensaje_id: mensaje.id,
              });
            }
          } catch {
            erroresLectura++;

            eventos.push({
              guia: null,
              envio_id: null,
              evento: tipoEvento,
              fecha:
                mensaje.receivedDateTime ||
                null,
              resultado:
                "error_lectura_mensaje",
                mensaje_id: mensaje.id,
            });
          }
        }

        resultados.push({
          cuenta: cuenta.correo,
          success:
            erroresLectura === 0,
          revisados:
            lectura.mensajes.length,
          paginasConsultadas:
            lectura.paginasConsultadas,
          limitePaginasAlcanzado:
            lectura.limitePaginasAlcanzado,
          correosPaquetexpress:
            correosPaquetexpress.length,
          erroresLectura,
          eventos,
        });
      } catch {
        resultados.push({
          cuenta: cuenta.correo,
          success: false,
          error:
            "No se pudo consultar esta cuenta.",
          eventos: [],
        });
      }
    }

    const lecturaCompleta =
      resultados.every(
        (resultado) =>
          resultado.success &&
          !resultado.limitePaginasAlcanzado
      );

    return NextResponse.json({
      success: lecturaCompleta,
      modo: "solo_lectura",
      fechaInicio:
        configuracion.fecha_inicio,
      automatizacionActiva:
        configuracion.automatizacion_activa,
      registroEventosActivo:
        configuracion.registro_eventos_activo,
      modificaEnvios: false,
      registraNotificaciones: false,
      enviaWhatsapp: false,
      totalCuentas: resultados.length,
      resultados,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "No se pudo realizar la revisi├│n.",
      },
      { status: 500 }
    );
  }
}