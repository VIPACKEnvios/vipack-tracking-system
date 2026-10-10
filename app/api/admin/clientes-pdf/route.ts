import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUTA_CLIENTES = "Envios/Recoleccion por cliente";
const GRAPH = "https://graph.microsoft.com/v1.0";

type CarpetaGraph = { id: string; name: string; folder?: unknown };
type Cliente = {
  id: number;
  id_cliente: number | null;
  nombre: string | null;
  carpeta_cliente: string | null;
  telefono_whatsapp: string | null;
  onedrive_folder_id: string | null;
};
type ConexionOneDrive = { id: number | string; refresh_token: string };
type Registro = { id: string; nombre: string; telefono: string; carpeta: string };
type Incidencia = { carpeta: string; motivo: string };

// Reutiliza exactamente el formato de sesión creado por /api/login.
function verificarSesionAdmin(request: NextRequest): boolean {
  const secret = process.env.VIPACK_SESSION_SECRET;
  const token = request.cookies.get("vipack-auth")?.value;
  if (!secret || secret.length < 32 || !token) return false;
  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== "v1") return false;
  const [, expiracionTexto, firma] = partes;
  if (!/^\d+$/.test(expiracionTexto) || !/^[a-f0-9]{64}$/.test(firma)) return false;
  const expiracion = Number(expiracionTexto);
  if (!Number.isSafeInteger(expiracion) || expiracion <= Math.floor(Date.now() / 1000)) return false;
  const firmaEsperada = createHmac("sha256", secret)
    .update(`v1.${expiracionTexto}`)
    .digest();
  const firmaRecibida = Buffer.from(firma, "hex");
  return firmaRecibida.length === firmaEsperada.length && timingSafeEqual(firmaRecibida, firmaEsperada);
}

function obtenerSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración de Supabase.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SupabaseAdmin = ReturnType<typeof obtenerSupabaseAdmin>;

function normalizar(valor: string | null | undefined): string {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function obtenerToken(supabase: SupabaseAdmin): Promise<string> {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Falta configuración de OneDrive.");

  const { data, error } = await supabase
    .from("onedrive_connections")
    .select("id, refresh_token")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo consultar la conexión de OneDrive: ${error.message}`);
  const conexion = data as ConexionOneDrive | null;
  if (!conexion?.refresh_token) throw new Error("No hay conexión activa de OneDrive.");

  const respuesta = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: conexion.refresh_token,
        scope: "openid profile offline_access User.Read Files.ReadWrite",
      }),
      cache: "no-store",
    }
  );
  const datos: unknown = await respuesta.json();
  if (!respuesta.ok || !datos || typeof datos !== "object" || !("access_token" in datos) || typeof datos.access_token !== "string") {
    throw new Error("No se pudo renovar el acceso a OneDrive.");
  }
  const tokenData = datos as { access_token: string; refresh_token?: string };
  if (tokenData.refresh_token && tokenData.refresh_token !== conexion.refresh_token) {
    const { error: actualizarError } = await supabase
      .from("onedrive_connections")
      .update({ refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() })
      .eq("id", conexion.id);
    if (actualizarError) throw new Error("No se pudo guardar la sesión renovada de OneDrive.");
  }
  return tokenData.access_token;
}

async function consultarGraph(url: string, token: string): Promise<unknown> {
  const respuesta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`Error de OneDrive (${respuesta.status}).`);
  return respuesta.json();
}

type GraphPagina = { value?: CarpetaGraph[]; "@odata.nextLink"?: string };
type GraphPadre = { id?: string; folder?: unknown };

async function obtenerCarpetas(token: string): Promise<CarpetaGraph[]> {
  const ruta = RUTA_CLIENTES.split("/").map(encodeURIComponent).join("/");
  const padre = (await consultarGraph(
    `${GRAPH}/me/drive/root:/${ruta}?$select=id,name,folder`, token
  )) as GraphPadre;
  if (!padre?.id || !padre.folder) throw new Error("No se encontró la carpeta principal de clientes.");

  const carpetas: CarpetaGraph[] = [];
  let url: string | null = `${GRAPH}/me/drive/items/${encodeURIComponent(padre.id)}/children?$select=id,name,folder&$top=200`;
  const visitadas = new Set<string>();
  while (url) {
    const actual: string = url;
    const parsed = new URL(actual);
    if (parsed.origin !== "https://graph.microsoft.com" || !parsed.pathname.startsWith("/v1.0/")) {
      throw new Error("OneDrive devolvió una paginación no válida.");
    }
    if (visitadas.has(actual) || visitadas.size >= 100) throw new Error("Paginación inesperada de OneDrive.");
    visitadas.add(actual);
    const pagina = (await consultarGraph(actual, token)) as GraphPagina;
    if (!Array.isArray(pagina.value)) throw new Error("Respuesta inválida de OneDrive.");
    carpetas.push(...pagina.value.filter((item) => Boolean(item?.folder && item?.id && item?.name)));
    url = typeof pagina["@odata.nextLink"] === "string" ? pagina["@odata.nextLink"] : null;
  }
  return carpetas;
}

export async function GET(request: NextRequest) {
  if (!verificarSesionAdmin(request)) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
  }
  try {
    const supabase = obtenerSupabaseAdmin();
    const { data, error } = await supabase
      .from("clientes_inventario")
      .select("id,id_cliente,nombre,carpeta_cliente,telefono_whatsapp,onedrive_folder_id")
      .eq("activo", true);
    if (error) throw new Error(`No se pudieron consultar los clientes: ${error.message}`);
    const clientes = (data || []) as Cliente[];
    const token = await obtenerToken(supabase);
    const carpetas = await obtenerCarpetas(token);

    const incidencias: Incidencia[] = [];
    const registros: Registro[] = [];
    const patron = /^(\d{5})(?:\s+|\s*[-–—]\s*)(.+)$/;
    const conteoIds = new Map<number, number>();
    for (const carpeta of carpetas) {
      const match = carpeta.name.match(patron);
      if (match) {
        const id = Number(match[1]);
        conteoIds.set(id, (conteoIds.get(id) || 0) + 1);
      }
    }

    const clientesUsados = new Set<number>();
    for (const carpeta of carpetas) {
      const match = carpeta.name.match(patron);
      if (!match) {
        incidencias.push({ carpeta: carpeta.name, motivo: "Carpeta sin ID de cinco dígitos o sin nombre." });
        continue;
      }
      const numero = Number(match[1]);
      if ((conteoIds.get(numero) || 0) > 1) {
        incidencias.push({ carpeta: carpeta.name, motivo: "ID repetido en OneDrive." });
        continue;
      }
      const nombreCarpeta = normalizar(match[2]);
      const porFolderId = clientes.filter((c) => c.onedrive_folder_id === carpeta.id);
      const porNombre = clientes.filter(
        (c) => normalizar(c.nombre) === nombreCarpeta || normalizar(c.carpeta_cliente) === normalizar(carpeta.name)
      );
      // Una coincidencia física y una coincidencia de nombre que discrepan requieren revisión.
      if (porFolderId.length && porNombre.length && !porNombre.some((c) => c.id === porFolderId[0].id)) {
        incidencias.push({ carpeta: carpeta.name, motivo: "El identificador físico y el nombre apuntan a clientes diferentes." });
        continue;
      }
      const candidatos = porFolderId.length ? porFolderId : porNombre;
      if (candidatos.length !== 1) {
        incidencias.push({ carpeta: carpeta.name, motivo: candidatos.length ? "Coincidencia ambigua entre clientes." : "Sin cliente activo confirmado." });
        continue;
      }
      const cliente = candidatos[0];
      // Si el cliente tiene un ID físico distinto, no asignarlo por nombre a otra carpeta.
      if (cliente.onedrive_folder_id && cliente.onedrive_folder_id !== carpeta.id) {
        incidencias.push({ carpeta: carpeta.name, motivo: "El cliente está vinculado a otra carpeta de OneDrive." });
        continue;
      }
      if (clientesUsados.has(cliente.id)) {
        incidencias.push({ carpeta: carpeta.name, motivo: "Cliente vinculado a varias carpetas." });
        continue;
      }
      clientesUsados.add(cliente.id);
      registros.push({
        id: match[1],
        nombre: cliente.nombre || match[2].trim(),
        telefono: cliente.telefono_whatsapp || "",
        carpeta: carpeta.name,
      });
    }
    registros.sort((a, b) => Number(a.id) - Number(b.id));
    return NextResponse.json(
      { success: true, total: registros.length, clientes: registros, incidencias },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET admin clientes-pdf:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo preparar el listado. Revisa los registros del servidor." },
      { status: 500 }
    );
  }
}
