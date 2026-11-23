import { NextRequest, NextResponse } from "next/server";
import { autorizarEvidenciaRecolector } from "@/lib/recolector-autorizacion";
import { GET as obtenerEvidencias } from "@/app/api/recolecciones/[folio]/evidencias/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Contexto = {
  params: Promise<{ folio: string }>;
};

function responderError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

async function obtenerNotasAutorizadas(
  folio: string,
  urlBase: string
): Promise<Response> {
  const urlInterna = new URL(
    `/api/recolecciones/${encodeURIComponent(folio)}/evidencias`,
    urlBase
  );

  const respuesta = await obtenerEvidencias(
    new Request(urlInterna.toString()),
    {
      params: Promise.resolve({ folio }),
    }
  );

  if (!respuesta.ok) {
    return responderError(
      "No se pudieron consultar las notas.",
      respuesta.status
    );
  }

  const datos = await respuesta.json();

  if (
    !datos ||
    datos.success !== true ||
    !Array.isArray(datos.notas)
  ) {
    return responderError("Respuesta de notas invalida.", 502);
  }

  const prefijo = folio.toLowerCase();

  const notas = datos.notas
    .filter((nota: unknown) => {
      if (!nota || typeof nota !== "object") return false;

      const archivo = nota as Record<string, unknown>;

      if (
        typeof archivo.id !== "string" ||
        typeof archivo.nombre !== "string"
      ) {
        return false;
      }

      const nombre = archivo.nombre.toLowerCase();

      return nombre.startsWith(prefijo + ".nota-");
    })
    .map((nota: Record<string, unknown>) => ({
      id: nota.id,
      nombre: nota.nombre,
      size: nota.size,
      lastModifiedDateTime: nota.lastModifiedDateTime,
    }));

  return NextResponse.json(
    { success: true, folio, total: notas.length, notas },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
export async function GET(
  request: NextRequest,
  contexto: Contexto
): Promise<Response> {
  try {
    const { folio } = await contexto.params;

    const autorizacion = await autorizarEvidenciaRecolector(
      request.headers.get("authorization") || "",
      folio
    );

    if (!autorizacion.autorizado) {
      return responderError(
        autorizacion.error,
        autorizacion.status
      );
    }

    const url = new URL(request.url);
    const archivoId = url.searchParams.get("archivoId")?.trim();

    if (archivoId) {
      if (archivoId.length > 256) {
        return responderError("Identificador invalido.", 400);
      }


      const respuestaListado = await obtenerNotasAutorizadas(autorizacion.folio, request.url);

      if (!respuestaListado.ok) {
        return responderError(
          "No se pudo validar la nota.",
          respuestaListado.status
        );
      }

      const datosListado = await respuestaListado.json();

      const archivoAutorizado =
        Array.isArray(datosListado.notas) &&
        datosListado.notas.some(
          (nota: { id?: string }) => nota.id === archivoId
        );

      if (!archivoAutorizado) {
        return responderError(
          "La nota no pertenece a esta recoleccion.",
          404
        );
      }

      const urlInterna = new URL(
        `/api/recolecciones/${encodeURIComponent(
          autorizacion.folio
        )}/evidencias`,
        request.url
      );

      urlInterna.searchParams.set("archivoId", archivoId);

      const solicitudInterna = new Request(
        urlInterna.toString(),
        { method: "GET" }
      );

      const respuesta = await obtenerEvidencias(
        solicitudInterna,
        {
          params: Promise.resolve({
            folio: autorizacion.folio,
          }),
        }
      );

      respuesta.headers.set(
        "Cache-Control",
        "private, no-store, max-age=0"
      );

      return respuesta;
    }

    const respuesta = await obtenerNotasAutorizadas(
      autorizacion.folio,
      request.url
    );

    if (!respuesta.ok) {
      return responderError(
        "No se pudieron consultar las notas.",
        respuesta.status
      );
    }

    const datos = await respuesta.json();

    if (
      !datos ||
      datos.success !== true ||
      !Array.isArray(datos.notas)
    ) {
      return responderError(
        "Respuesta de notas invalida.",
        502
      );
    }

    const notas = datos.notas;

    return NextResponse.json(
      {
        success: true,
        folio: autorizacion.folio,
        total: notas.length,
        notas,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error consultando notas del recolector:", error);

    return responderError(
      "No se pudieron consultar las notas.",
      500
    );
  }
}
