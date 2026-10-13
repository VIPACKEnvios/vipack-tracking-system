
import { NextRequest, NextResponse } from "next/server";
import { verificarSesionAdmin } from "@/lib/vipack-auth";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key);

    const { data: conexion, error } = await supabase
      .from("onedrive_connections")
      .select("refresh_token")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error || !conexion?.refresh_token) {
      throw new Error("No existe conexión OneDrive");
    }

    const respuesta = await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.ONEDRIVE_CLIENT_ID!,
          client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: conexion.refresh_token,
          scope: "openid profile offline_access User.Read Files.ReadWrite",
        }),
        cache: "no-store",
      }
    );

    const auth = await respuesta.json();
    if (!respuesta.ok || !auth.access_token) {
      throw new Error("No se pudo consultar OneDrive");
    }

    const headers = { Authorization: `Bearer ${auth.access_token}` };
    const ruta = "Envios/Recoleccion por cliente";
    const raizRespuesta = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(ruta)}?$select=id,name,webUrl,folder`,
      { headers, cache: "no-store" }
    );

    if (!raizRespuesta.ok) throw new Error("No se encontró la carpeta raíz");
    const raiz = await raizRespuesta.json();

    let siguiente: string | null =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(raiz.id)}/children?$select=id,name,webUrl,folder&$top=200`;

    const encontradas: Array<{ id: string; nombre: string; url: string }> = [];

    while (siguiente) {
      const r: Response = await fetch(siguiente, { headers, cache: "no-store" });
      if (!r.ok) throw new Error(`Error consultando carpetas: ${r.status}`);
      const datos: any = await r.json();

      for (const item of datos.value ?? []) {
        const nombre = String(item.name ?? "").replace(/\s+/g, " ").trim();
        if (item.folder && (nombre === "00055" || nombre.startsWith("00055 "))) {
          encontradas.push({
            id: String(item.id),
            nombre,
            url: String(item.webUrl ?? ""),
          });
        }
      }

      siguiente = datos["@odata.nextLink"] ?? null;
    }

    return NextResponse.json({
      carpeta_raiz: raiz.name,
      url_raiz: raiz.webUrl,
      cantidad: encontradas.length,
      carpetas: encontradas,
    });
  } catch (e) {
    console.error("Diagnóstico OneDrive:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error de diagnóstico" },
      { status: 500 }
    );
  }
}

