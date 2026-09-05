import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
 * IMPORTANTE:
 * La imagen continúa guardada únicamente en OneDrive.
 *
 * Supabase aquí NO guarda fotografías ni comprobantes.
 * Solamente se usa porque actualmente ahí está almacenado
 * el refresh_token de la conexión existente con OneDrive.
 */

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan variables para recuperar la conexión de OneDrive."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function obtenerAccessToken() {
  const clientId =
    process.env.ONEDRIVE_CLIENT_ID;

  const clientSecret =
    process.env.ONEDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan variables de configuración de OneDrive."
    );
  }

  const supabase =
    crearSupabase();

  const {
    data: conexion,
    error,
  } = await supabase
    .from("onedrive_connections")
    .select("id, refresh_token")
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la conexión de OneDrive: ${error.message}`
    );
  }

  if (!conexion?.refresh_token) {
    throw new Error(
      "No existe una conexión activa de OneDrive."
    );
  }

  const tokenResponse =
    await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: new URLSearchParams({
          client_id:
            clientId,

          client_secret:
            clientSecret,

          grant_type:
            "refresh_token",

          refresh_token:
            conexion.refresh_token,

          scope:
            "openid profile offline_access User.Read Files.ReadWrite",
        }),

        cache: "no-store",
      }
    );

  const tokenData =
    await leerJsonSeguro(
      tokenResponse
    );

  if (!tokenResponse.ok) {
    throw new Error(
      tokenData?.error_description ||
        tokenData?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    tokenData?.access_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

  const nuevoRefreshToken =
    tokenData?.refresh_token;

  if (
    nuevoRefreshToken &&
    nuevoRefreshToken !==
      conexion.refresh_token
  ) {
    const {
      error: updateError,
    } = await supabase
      .from("onedrive_connections")
      .update({
        refresh_token:
          nuevoRefreshToken,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", conexion.id);

    if (updateError) {
      console.error(
        "No se pudo actualizar refresh_token:",
        updateError
      );
    }
  }

  return accessToken;
}

function limpiarRuta(
  valor: string
) {
  let ruta =
    String(valor || "")
      .trim()
      .replace(/\\/g, "/");

  /*
   * No permitimos rutas externas
   * ni subir fuera de la carpeta
   * de comprobantes.
   */

  ruta =
    ruta.replace(
      /^\/+/,
      ""
    );

  if (
    !ruta.startsWith(
      "Envios/Comprobantes_Pagos/"
    )
  ) {
    throw new Error(
      "Ruta de comprobante no permitida."
    );
  }

  if (
    ruta.includes("..")
  ) {
    throw new Error(
      "Ruta de comprobante no válida."
    );
  }

  return ruta;
}

function tipoContenido(
  nombre: string
) {
  const extension =
    nombre
      .split(".")
      .pop()
      ?.toLowerCase();

  if (
    extension === "png"
  ) {
    return "image/png";
  }

  if (
    extension === "webp"
  ) {
    return "image/webp";
  }

  if (
    extension === "jpeg" ||
    extension === "jpg"
  ) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const rutaParam =
      url.searchParams.get(
        "ruta"
      );

    if (!rutaParam) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Falta la ruta del comprobante.",
        },
        {
          status: 400,
        }
      );
    }

    const ruta =
      limpiarRuta(
        decodeURIComponent(
          rutaParam
        )
      );

    const accessToken =
      await obtenerAccessToken();

    const graphUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        ruta
      )}:/content`;

    const response =
      await fetch(
        graphUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache: "no-store",
        }
      );

    if (!response.ok) {
      if (
        response.status ===
        404
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "No se encontró el comprobante en OneDrive.",
          },
          {
            status: 404,
          }
        );
      }

      const detalle =
        await response.text();

      throw new Error(
        `No se pudo descargar el comprobante. ${detalle}`
      );
    }

    const buffer =
      await response.arrayBuffer();

    const nombre =
      ruta
        .split("/")
        .pop() ||
      "comprobante";

    return new NextResponse(
      buffer,
      {
        status: 200,

        headers: {
          "Content-Type":
            response.headers.get(
              "content-type"
            ) ||
            tipoContenido(
              nombre
            ),

          "Content-Disposition":
            `inline; filename="${nombre}"`,

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (
    error: unknown
  ) {
    console.error(
      "Error mostrando comprobante:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido mostrando comprobante.",
      },
      {
        status: 500,
      }
    );
  }
}