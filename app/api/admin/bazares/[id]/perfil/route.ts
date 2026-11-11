import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "bazares-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FACEBOOK = 2048;

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ContextoRuta = {
  params: Promise<{ id: string }>;
};

function validarFacebook(valor: string): string | null {
  if (!valor || valor.length > MAX_FACEBOOK || /[\u0000-\u001F\u007F]/.test(valor)) {
    return null;
  }

  try {
    const url = new URL(valor);
    const dominios = new Set([
      "facebook.com",
      "www.facebook.com",
      "web.facebook.com",
      "m.facebook.com",
      "fb.com",
      "www.fb.com",
    ]);

    if (
      url.protocol !== "https:" ||
      !dominios.has(url.hostname.toLowerCase()) ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== ""
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function coincideContenidoImagen(contenido: Buffer, tipo: string): boolean {
  if (tipo === "image/jpeg") {
    return (
      contenido.length >= 4 &&
      contenido[0] === 0xff &&
      contenido[1] === 0xd8 &&
      contenido[2] === 0xff &&
      contenido[contenido.length - 2] === 0xff &&
      contenido[contenido.length - 1] === 0xd9
    );
  }

  if (tipo === "image/png") {
    const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return contenido.length >= 24 && contenido.subarray(0, 8).equals(firma);
  }

  if (tipo === "image/webp") {
    return (
      contenido.length >= 16 &&
      contenido.toString("ascii", 0, 4) === "RIFF" &&
      contenido.toString("ascii", 8, 12) === "WEBP" &&
      ["VP8 ", "VP8L", "VP8X"].includes(contenido.toString("ascii", 12, 16))
    );
  }

  return false;
}

function rutaAnteriorSegura(valor: string | null, id: string): string | null {
  if (!valor) return null;

  let ruta = valor;
  if (valor.startsWith("https://")) {
    try {
      const url = new URL(valor);
      const baseSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseSupabase || url.origin !== new URL(baseSupabase).origin) return null;
      const prefijo = `/storage/v1/object/public/${BUCKET}/`;
      if (!url.pathname.startsWith(prefijo)) return null;
      ruta = decodeURIComponent(url.pathname.slice(prefijo.length));
    } catch {
      return null;
    }
  }

  // Nunca eliminar archivos fuera de la carpeta de este bazar.
  if (!new RegExp(`^${id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(ruta)) {
    return null;
  }
  return ruta;
}

export async function PATCH(request: NextRequest, contexto: ContextoRuta) {
  if (!verificarSesionAdmin(request)) {
    return NextResponse.json(
      { success: false, error: "No autorizado." },
      { status: 401 }
    );
  }

  const { id } = await contexto.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json(
      { success: false, error: "ID de bazar inválido." },
      { status: 400 }
    );
  }

  try {
    const tipoSolicitud = request.headers.get("content-type") || "";
    if (!tipoSolicitud.toLowerCase().startsWith("multipart/form-data;")) {
      return NextResponse.json(
        { success: false, error: "El formulario debe enviarse como multipart/form-data." },
        { status: 415 }
      );
    }

    const formulario = await request.formData();
    const facebookCampo = formulario.get("facebook");
    const imagenCampo = formulario.get("logo");

    if (typeof facebookCampo !== "string") {
      return NextResponse.json(
        { success: false, error: "Falta el campo Facebook." },
        { status: 400 }
      );
    }

    const facebookTexto = facebookCampo.trim();
    const facebook = facebookTexto ? validarFacebook(facebookTexto) : "";
    if (facebookTexto && !facebook) {
      return NextResponse.json(
        { success: false, error: "Introduce una URL válida de Facebook con HTTPS." },
        { status: 400 }
      );
    }

    if (imagenCampo !== null && !(imagenCampo instanceof File)) {
      return NextResponse.json(
        { success: false, error: "El logotipo enviado no es un archivo válido." },
        { status: 400 }
      );
    }

    const imagen = imagenCampo instanceof File ? imagenCampo : null;
    let contenido: Buffer | null = null;
    if (imagen) {
      if (!TIPOS[imagen.type] || imagen.size === 0 || imagen.size > MAX_BYTES) {
        return NextResponse.json(
          { success: false, error: "El logotipo debe ser JPG, PNG o WebP y pesar máximo 2 MB." },
          { status: 400 }
        );
      }

      contenido = Buffer.from(await imagen.arrayBuffer());
      if (contenido.length !== imagen.size || !coincideContenidoImagen(contenido, imagen.type)) {
        return NextResponse.json(
          { success: false, error: "El contenido del archivo no corresponde a una imagen JPG, PNG o WebP válida." },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { data: bazar, error: errorBazar } = await supabase
      .from("bazares")
      .select("id, logo_url")
      .eq("id", id)
      .single();

    if (errorBazar || !bazar) {
      return NextResponse.json(
        { success: false, error: "Bazar no encontrado." },
        { status: 404 }
      );
    }

    const logoAnterior = (bazar.logo_url as string | null) ?? null;
    let logoUrl = logoAnterior;
    let nuevaRuta: string | null = null;

    if (imagen && contenido) {
      nuevaRuta = `${id}/${randomUUID()}.${TIPOS[imagen.type]}`;
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET)
        .upload(nuevaRuta, contenido, {
          contentType: imagen.type,
          upsert: false,
        });

      if (errorSubida) {
        console.error("Error subiendo logotipo:", errorSubida);
        return NextResponse.json(
          { success: false, error: "No fue posible subir el logotipo." },
          { status: 500 }
        );
      }
      logoUrl = nuevaRuta;
    }

    // Solo guarda si el logotipo no fue cambiado por otro administrador
    // desde que se consultó el registro.
    let consulta = supabase
      .from("bazares")
      .update({
        facebook,
        logo_url: logoUrl,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", id);

    consulta = logoAnterior === null
      ? consulta.is("logo_url", null)
      : consulta.eq("logo_url", logoAnterior);

    const { data: actualizado, error: errorActualizacion } = await consulta
      .select("id, facebook, logo_url, fecha_actualizacion")
      .maybeSingle();

    if (errorActualizacion || !actualizado) {
      if (nuevaRuta) {
        const { error: errorLimpieza } = await supabase.storage.from(BUCKET).remove([nuevaRuta]);
        if (errorLimpieza) console.error("No se pudo limpiar la nueva imagen:", errorLimpieza);
      }
      return NextResponse.json(
        {
          success: false,
          error: errorActualizacion
            ? "No fue posible guardar el perfil."
            : "El perfil cambió durante la edición. Actualiza la página y vuelve a intentarlo.",
        },
        { status: errorActualizacion ? 500 : 409 }
      );
    }

    // Limpiar el logotipo anterior únicamente después de confirmar el guardado.
    // Si la limpieza falla, no se revierte el perfil: el nuevo logo ya está guardado.
    if (nuevaRuta && logoAnterior && logoAnterior !== nuevaRuta) {
      const rutaVieja = rutaAnteriorSegura(logoAnterior, id);
      if (rutaVieja) {
        const { error: errorLimpieza } = await supabase.storage.from(BUCKET).remove([rutaVieja]);
        if (errorLimpieza) console.error("No se pudo eliminar el logotipo anterior:", errorLimpieza);
      }
    }

    return NextResponse.json({
      success: true,
      bazar: actualizado,
      mensaje: "Perfil público actualizado correctamente.",
    });
  } catch (error) {
    console.error("Error actualizando perfil de bazar:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al actualizar el perfil." },
      { status: 500 }
    );
  }
}