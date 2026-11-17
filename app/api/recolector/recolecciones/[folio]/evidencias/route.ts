import { NextRequest, NextResponse } from "next/server";
import { autorizarEvidenciaRecolector } from "@/lib/recolector-autorizacion";
import {
  obtenerAccessToken,
  resolverRutaFotosCliente,
  nombreFotoAndroid,
  buscarFotoAndroidExistente,
  compararFotoAndroidExistente,
  subirArchivo,
} from "@/lib/recolector-onedrive";

export const runtime = "nodejs";

type Contexto = {
  params: Promise<{ folio: string }>;
};

export async function POST(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    const { folio } = await contexto.params;

    const autorizacion = await autorizarEvidenciaRecolector(
      request.headers.get("authorization") || "",
      folio
    );

    if (!autorizacion.autorizado) {
      return NextResponse.json(
        {
          success: false,
          error: autorizacion.error,
        },
        { status: autorizacion.status }
      );
    }

    const tipoContenido = request.headers.get("content-type") || "";

    if (!tipoContenido.toLowerCase().startsWith("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Se requiere multipart/form-data." },
        { status: 415 }
      );
    }

    const formulario = await request.formData();
    const archivo = formulario.get("archivo");
    const photoId = formulario.get("photoId");

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Fotografia requerida." },
        { status: 400 }
      );
    }

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!tiposPermitidos.includes(archivo.type.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "Formato de imagen no permitido." },
        { status: 415 }
      );
    }

    if (archivo.size === 0 || archivo.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "La fotografia debe medir entre 1 byte y 8 MB." },
        { status: 413 }
      );
    }

    const firmaImagen = new Uint8Array(
      await archivo.slice(0, 16).arrayBuffer()
    );

    const esJpeg =
      firmaImagen.length >= 3 &&
      firmaImagen[0] === 0xff &&
      firmaImagen[1] === 0xd8 &&
      firmaImagen[2] === 0xff;

    const esPng =
      firmaImagen.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (valor, indice) => firmaImagen[indice] === valor
      );

    const esWebp =
      firmaImagen.length >= 12 &&
      String.fromCharCode(...firmaImagen.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...firmaImagen.slice(8, 12)) === "WEBP";

    const firmaValida =
      (archivo.type === "image/jpeg" && esJpeg) ||
      (archivo.type === "image/png" && esPng) ||
      (archivo.type === "image/webp" && esWebp);

    if (!firmaValida) {
      return NextResponse.json(
        {
          success: false,
          error: "El contenido no corresponde a una imagen valida.",
        },
        { status: 415 }
      );
    }
    if (
      typeof photoId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photoId)
    ) {
      return NextResponse.json(
        { success: false, error: "Identificador de fotografia invalido." },
        { status: 400 }
      );
    }
    const accesoOneDrive = await obtenerAccessToken();

    const destinoCliente = await resolverRutaFotosCliente(
      accesoOneDrive,
      autorizacion.folio
    );

    if (!destinoCliente.ruta || !destinoCliente.cliente) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo identificar la carpeta del cliente.",
        },
        { status: 404 }
      );
    }
    const extensionFoto =
      archivo.type === "image/png"
        ? "png"
        : archivo.type === "image/webp"
          ? "webp"
          : "jpg";

    const nombreFinalFoto = nombreFotoAndroid(
      autorizacion.folio,
      photoId,
      extensionFoto
    );

    const fotoExistente = await buscarFotoAndroidExistente(
      accesoOneDrive,
      destinoCliente.ruta,
      nombreFinalFoto
    );

    if (fotoExistente) {
      const contenidoIdentico = await compararFotoAndroidExistente(
        accesoOneDrive,
        fotoExistente.id,
        archivo
      );

      if (contenidoIdentico) {
        return NextResponse.json(
          {
            success: true,
            duplicado: true,
            photoId,
            archivo: {
              id: fotoExistente.id,
              nombre: fotoExistente.nombre,
              webUrl: fotoExistente.webUrl,
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "El identificador ya pertenece a otra fotografia diferente.",
          photoId,
        },
        { status: 409 }
      );
    }
    try {
      const fotoSubida = await subirArchivo(
        accesoOneDrive,
        destinoCliente.ruta,
        archivo,
        nombreFinalFoto
      );

      return NextResponse.json(
        {
          success: true,
          duplicado: false,
          photoId,
          archivo: {
            id: fotoSubida.id,
            nombre: fotoSubida.nombre,
            webUrl: fotoSubida.webUrl,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "La fotografia ya existe en OneDrive."
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "La fotografia ya existe. Debe verificarse antes de reintentar.",
            photoId,
          },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Error en evidencias de recolector:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo validar la solicitud.",
      },
      { status: 500 }
    );
  }
}