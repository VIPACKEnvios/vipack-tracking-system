
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_LOGOS = "bazares-logos";

function obtenerFacebookSeguro(valor: string | null): string | null {
  if (!valor) return null;

  try {
    const url = new URL(valor.trim());

    const dominiosPermitidos = [
      "facebook.com",
      "www.facebook.com",
      "web.facebook.com",
      "m.facebook.com",
      "fb.com",
      "www.fb.com",
    ];

    if (
      url.protocol !== "https:" ||
      !dominiosPermitidos.includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const busqueda = String(searchParams.get("buscar") || "")
      .trim()
      .replace(/[%(),]/g, " ")
      .slice(0, 100);

    let consulta = supabaseAdmin
      .from("bazares")
      .select(`
        id,
        folio,
        nombre_bazar,
        estado,
        facebook,
        logo_url
      `)
      .eq("estado", "activo")
      .order("nombre_bazar", { ascending: true });

    if (busqueda) {
      consulta = consulta.ilike("nombre_bazar", `%${busqueda}%`);
    }

    const { data, error } = await consulta;

    if (error) {
      console.error("Error consultando bazares activos:", error);

      return NextResponse.json(
        {
          success: false,
          error: "No fue posible consultar los bazares registrados.",
        },
        { status: 500 }
      );
    }

    const bazares = (data || []).map((bazar) => {
      let logoPublico: string | null = null;

      if (bazar.logo_url) {
        // Las imágenes nuevas se guardan como rutas dentro del bucket.
        // No se aceptan URLs externas arbitrarias.
        const ruta = bazar.logo_url.trim();

        if (
          ruta.startsWith(`${bazar.id}/`) &&
          !ruta.includes("..") &&
          !ruta.includes("\\")
        ) {
          const { data: imagen } = supabaseAdmin.storage
            .from(BUCKET_LOGOS)
            .getPublicUrl(ruta);

          logoPublico = imagen.publicUrl;
        }
      }

      return {
        id: bazar.id,
        folio: bazar.folio,
        nombre_bazar: bazar.nombre_bazar,
        estado: bazar.estado,
        facebook: obtenerFacebookSeguro(bazar.facebook),
        logo_url: logoPublico,
      };
    });

    return NextResponse.json({
      success: true,
      encontrado: bazares.length > 0,
      bazares,
      total: bazares.length,
      mensaje:
        bazares.length > 0
          ? busqueda
            ? "Se encontraron bazares registrados."
            : "Lista de bazares registrados."
          : busqueda
            ? "No se encontró un bazar activo con ese nombre."
            : "Todavía no hay bazares activos.",
    });
  } catch (error) {
    console.error("Error en la consulta de bazares:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No fue posible realizar la consulta.",
      },
      { status: 500 }
    );
  }
}
