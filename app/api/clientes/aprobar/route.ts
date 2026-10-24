import { NextResponse, type NextRequest } from "next/server";

import { verificarSesionAdmin } from "@/lib/vipack-auth";

import { createClient } from "@supabase/supabase-js";

import { randomUUID } from "crypto";

import * as XLSX from "xlsx";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const RUTA_CLIENTES = "Envios/Recoleccion por cliente";

const RUTA_EXCEL = "Envios/control_recolecciones_bodega.xlsx";

const HOJA_CLIENTES = "Clientes";

const RECUPERACION = { solicitud: 8, id: 55, nombre: "Isabel Alvarado" };

// Recuperación específica de la solicitud 8. El bloqueo debe estar inactivo al menos 5 minutos.

const EDAD_MINIMA_BLOQUEO_MS = 5 * 60 * 1000;

type Fila = Record<string, unknown>;

type Solicitud = {

  id: number; estado: string; nombre: string; telefono: string;

  direccion: string | null; referencia_domicilio: string | null;
  calle: string | null; numero_exterior: string | null;
  numero_interior: string | null; colonia: string | null;
  delegacion: string | null; codigo_postal: string | null;
  ciudad: string | null; estado_domicilio: string | null;

  id_cliente_asignado: number | null; carpeta_cliente: string | null;

  onedrive_folder_id: string | null;

};

const limpiar = (v: unknown) => String(v ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const numero = (n: number) => String(n).padStart(5, "0");

function idExcel(v: unknown): number | null {

  if (v === null || v === undefined || limpiar(v) === "") return null;

  const n = Number(limpiar(v).replace(/^#/, ""));

  return Number.isInteger(n) && n > 0 ? n : null;

}

function telefono(v: unknown) {

  let s = typeof v === "number" ? Math.trunc(v).toString() : limpiar(v);

  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(s)) s = Math.trunc(Number(s)).toString();

  const n = s.replace(/\D/g, "");

  if (n.length === 10) return `521${n}`;

  if (n.length === 12 && n.startsWith("52")) return `521${n.slice(2)}`;

  return n;

}

async function jsonSeguro(r: Response): Promise<any> {

  try { return await r.json(); } catch { return null; }

}

function errorHttp(msg: string, status = 409): never {

  const e = new Error(msg) as Error & { status?: number };

  e.status = status;

  throw e;

}

function graphPath(path: string) {

  return `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(path)}`;

}

async function graphJson(url: string, token: string, init: RequestInit = {}) {

  const r = await fetch(url, {

    ...init,

    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },

    cache: "no-store",

  });

  const data = await jsonSeguro(r);

  if (!r.ok) errorHttp(data?.error?.message || `Microsoft Graph HTTP ${r.status}`, 502);

  return data;

}

async function descargarExcel(token: string) {

  const r = await fetch(`${graphPath(RUTA_EXCEL)}:/content`, {

    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",

  });

  if (!r.ok) errorHttp(`No se pudo descargar el Excel (HTTP ${r.status})`, 502);

  return Buffer.from(await r.arrayBuffer());

}

async function obtenerVersionExcel(token: string) {

  const item = await graphJson(`${graphPath(RUTA_EXCEL)}?$select=id,name,eTag`, token);

  if (!item?.id || !item?.eTag) errorHttp("No se obtuvo la versión del Excel", 502);

  return { id: String(item.id), etag: String(item.eTag) };

}

async function subirExcel(token: string, id: string, etag: string, contenido: Buffer) {

  // If-Match evita sobrescribir cambios hechos por otra operación.

  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(id)}/content`, {

    method: "PUT",

    headers: {

      Authorization: `Bearer ${token}`,

      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      "If-Match": etag,

    },

    body: new Uint8Array(contenido),

    cache: "no-store",

  });

  const data = await jsonSeguro(r);

  if (!r.ok) errorHttp(data?.error?.message || `No se actualizó el Excel (HTTP ${r.status}). Revisar antes de reintentar.`, 502);

  return data;

}

async function obtenerRaiz(token: string) {

  const item = await graphJson(`${graphPath(RUTA_CLIENTES)}?$select=id,name,folder`, token);

  if (!item?.id || !item?.folder) errorHttp("No se encontró la carpeta raíz de clientes", 502);

  return String(item.id);

}

async function buscarCarpetaPorNumero(token: string, raiz: string, id: number) {

  const prefijo = numero(id);

  let url: string | null = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(raiz)}/children?$select=id,name,folder&$top=200`;

  const encontradas: { id: string; name: string }[] = [];

  while (url) {

    const data: any = await graphJson(url, token);

    for (const item of data?.value ?? []) {

      const nombre = limpiar(item.name);

      if (item.folder && (nombre === prefijo || nombre.startsWith(`${prefijo} `))) {

        encontradas.push({ id: String(item.id), name: nombre });

      }

    }

    url = data?.["@odata.nextLink"] ?? null;

  }

  return encontradas;

}

async function crearCarpeta(token: string, raiz: string, nombre: string) {

  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(raiz)}/children`;

  return graphJson(url, token, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ name: nombre, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),

  });

}

function forzarTelefonosTexto(hoja: XLSX.WorkSheet) {

  if (!hoja["!ref"]) return;

  const rango = XLSX.utils.decode_range(hoja["!ref"]);

  let col = -1;

  for (let c = rango.s.c; c <= rango.e.c; c++) {

    const celda = hoja[XLSX.utils.encode_cell({ r: rango.s.r, c })];

    if (limpiar(celda?.v) === "TelefonoWhatsApp") { col = c; break; }

  }

  if (col < 0) return;

  for (let r = rango.s.r + 1; r <= rango.e.r; r++) {

    const celda = hoja[XLSX.utils.encode_cell({ r, c: col })];

    if (!celda) continue;

    const valor = telefono(celda.v);

    if (!valor) continue;

    celda.t = "s"; celda.v = valor; celda.z = "@"; delete celda.w;

  }

}

export async function POST(request: NextRequest) {

  if (!verificarSesionAdmin(request)) {

    return NextResponse.json(

      { success: false, error: "No autorizado. Inicia sesión nuevamente." },

      { status: 401 }

    );

  }

  let etapa = "inicio";

  let idAsignado: number | null = null;

  let bloqueoAdquirido = false;

  const bloqueoToken = randomUUID();

  try {

    const body = await request.json().catch(() => ({}));

    const solicitudId = Number(body?.solicitud_id);

    if (!Number.isInteger(solicitudId) || solicitudId <= 0) errorHttp("Solicitud inválida", 400);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const clientId = process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

    if (!url || !key || !clientId || !clientSecret) errorHttp("Faltan variables de entorno", 500);

    const supabase = createClient(url, key, {

      auth: { autoRefreshToken: false, persistSession: false },

    });

    // Mutex persistente y global: serializa todas las aprobaciones que escriben

    // en el mismo Excel y OneDrive, incluso entre instancias de Vercel.

    // En caso de error NO se libera automáticamente: podría haber cambios

    // parciales en OneDrive, Excel o Supabase. Requiere revisión manual.

    etapa = "adquirir_bloqueo";

    if (solicitudId === RECUPERACION.solicitud) {

      // Recuperar solo el bloqueo previo de esta solicitud, mediante CAS del token.

      // Un proceso que siga activo no debe ser desplazado.

      const { data: previo, error: ePrevio } = await supabase

        .from("vipack_bloqueo_aprobaciones")

        .select("id,solicitud_id,token,creado_en")

        .eq("id", 1).maybeSingle();

      if (ePrevio || !previo || Number(previo.solicitud_id) !== solicitudId) {

        errorHttp("No hay un bloqueo de recuperación válido para Isabel.", 409);

      }

      const edad = Date.now() - new Date(previo.creado_en).getTime();

      if (!Number.isFinite(edad) || edad < EDAD_MINIMA_BLOQUEO_MS) {

        errorHttp("El bloqueo es demasiado reciente para recuperarlo con seguridad.", 409);

      }

      const { data: tomado, error: eTomar } = await supabase

        .from("vipack_bloqueo_aprobaciones")

        .update({ token: bloqueoToken })

        .eq("id", 1).eq("solicitud_id", solicitudId)

        .eq("token", previo.token).eq("creado_en", previo.creado_en)

        .select("id").maybeSingle();

      if (eTomar || !tomado) {

        errorHttp("El bloqueo cambió o ya fue tomado. No se ejecutó la recuperación.", 409);

      }

    } else {

      const { data: bloqueo, error: eBloqueo } = await supabase

        .from("vipack_bloqueo_aprobaciones")

        .insert({ id: 1, token: bloqueoToken, solicitud_id: solicitudId })

        .select("id").maybeSingle();

      if (eBloqueo?.code === "23505") {

        errorHttp("Ya existe una aprobación en curso o pendiente de revisión.", 409);

      }

      if (eBloqueo || !bloqueo) {

        errorHttp(`No se pudo obtener el bloqueo: ${eBloqueo?.message || "sin confirmación"}`, 500);

      }

    }

    bloqueoAdquirido = true;

    const { data: solicitud, error: eSolicitud } = await supabase

      .from("solicitudes_clientes")

      .select("id,estado,nombre,telefono,direccion,referencia_domicilio,calle,numero_exterior,numero_interior,colonia,delegacion,codigo_postal,ciudad,estado_domicilio,id_cliente_asignado,carpeta_cliente,onedrive_folder_id")

      .eq("id", solicitudId).maybeSingle();

    if (eSolicitud) errorHttp(eSolicitud.message, 500);

    if (!solicitud) errorHttp("Solicitud no encontrada", 404);

    const s = solicitud as Solicitud;

    const recuperando = s.estado === "procesando";

    if (solicitudId === RECUPERACION.solicitud && !recuperando) {

      errorHttp("La solicitud 8 ya no está en estado procesando; no ejecutar recuperación.", 409);

    }

    if (s.estado !== "pendiente" && !recuperando) errorHttp("Solicitud ya atendida", 409);

    if (recuperando && (

      s.id !== RECUPERACION.solicitud ||

      Number(s.id_cliente_asignado) !== RECUPERACION.id ||

      limpiar(s.nombre) !== RECUPERACION.nombre ||

      s.carpeta_cliente || s.onedrive_folder_id

    )) errorHttp("Recuperación automática restringida: requiere revisión manual", 409);

    const nombre = limpiar(s.nombre);

    const tel = telefono(s.telefono);

    if (!nombre || !tel) errorHttp("Faltan nombre o teléfono", 400);

    const { data: conexion, error: eConexion } = await supabase

      .from("onedrive_connections").select("id,refresh_token")

      .order("id", { ascending: false }).limit(1).maybeSingle();

    if (eConexion || !conexion?.refresh_token) errorHttp("No existe conexión OneDrive", 500);

    const rToken = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {

      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },

      body: new URLSearchParams({

        client_id: clientId, client_secret: clientSecret,

        grant_type: "refresh_token", refresh_token: conexion.refresh_token,

        scope: "openid profile offline_access User.Read Files.ReadWrite",

      }), cache: "no-store",

    });

    const tokenData = await jsonSeguro(rToken);

    if (!rToken.ok || !tokenData?.access_token) errorHttp("No se pudo renovar acceso a OneDrive", 502);

    const token = String(tokenData.access_token);

    if (tokenData.refresh_token && tokenData.refresh_token !== conexion.refresh_token) {

      const { error } = await supabase.from("onedrive_connections")

        .update({ refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() })

        .eq("id", conexion.id);

      if (error) errorHttp("No se pudo guardar el nuevo token de OneDrive", 500);

    }

    etapa = "lectura_excel";

    const version = await obtenerVersionExcel(token);

    const excelOriginal = await descargarExcel(token);

    const versionTrasDescarga = await obtenerVersionExcel(token);

    if (versionTrasDescarga.id !== version.id || versionTrasDescarga.etag !== version.etag) {

      errorHttp("El Excel cambió durante la descarga. Revisar antes de continuar.", 409);

    }

    const libro = XLSX.read(excelOriginal, { type: "buffer" });

    const hoja = libro.Sheets[HOJA_CLIENTES];

    if (!hoja) errorHttp(`Falta hoja ${HOJA_CLIENTES}`, 409);

    const filas = XLSX.utils.sheet_to_json<Fila>(hoja, { defval: "", raw: true });

    if (filas.some(f => telefono(f["TelefonoWhatsApp"]) === tel)) {

      errorHttp("El teléfono ya existe en el Excel. Revisión manual necesaria", 409);

    }

    const ids = Array.from(new Set(filas.map(f => idExcel(f["ID Cliente"]))

      .filter((n): n is number => n !== null)));

    if (recuperando) {

      etapa = "validar_reserva_existente";

      const { data: reservas, error: eReserva } = await supabase

        .from("reservas_numeros_clientes").select("id_cliente,solicitud_id,estado")

        .eq("solicitud_id", solicitudId);

      if (eReserva) errorHttp(eReserva.message, 500);

      if (reservas?.length !== 1 || Number(reservas[0].id_cliente) !== RECUPERACION.id ||

          reservas[0].estado !== "reservado") errorHttp("Reserva inconsistente", 409);

      idAsignado = RECUPERACION.id;

    } else {

      etapa = "reservar_numero";

      const { data, error } = await supabase.rpc("reservar_numero_cliente", {

        p_solicitud_id: solicitudId, p_ids_excel: ids,

      });

      if (error || !Number.isInteger(Number(data)) || Number(data) <= 0) {

        errorHttp(error?.message || "No se pudo reservar ID", 409);

      }

      idAsignado = Number(data);

    }

    const id = idAsignado;

    const carpetaNombre = `${numero(id)} ${nombre}`;

    if (ids.includes(id)) errorHttp(`ID ${id} ya existe en Excel`, 409);

    const { data: clientesId, error: eClientes } = await supabase

      .from("clientes_inventario").select("id_cliente").eq("id_cliente", id);

    if (eClientes) errorHttp(eClientes.message, 500);

    if (clientesId?.length) errorHttp(`ID ${id} ya existe en inventario`, 409);

    const { data: otros, error: eOtros } = await supabase

      .from("solicitudes_clientes").select("id")

      .eq("id_cliente_asignado", id).neq("id", solicitudId);

    if (eOtros) errorHttp(eOtros.message, 500);

    if (otros?.length) errorHttp(`ID ${id} está asignado a otra solicitud`, 409);

    const { data: reservasId, error: eReservasId } = await supabase

      .from("reservas_numeros_clientes").select("solicitud_id")

      .eq("id_cliente", id);

    if (eReservasId) errorHttp(eReservasId.message, 500);

    if (reservasId?.length !== 1 || Number(reservasId[0].solicitud_id) !== solicitudId) {

      errorHttp("La reserva del ID no coincide con la solicitud", 409);

    }

    // Validar estructura antes de cualquier creación de carpeta en OneDrive.
    const encabezados = (XLSX.utils.sheet_to_json<unknown[]>(hoja, {

      header: 1, blankrows: false,

    })[0] ?? []).map(x => limpiar(x));

    const obligatorios = ["ID Cliente", "Nombre", "CarpetaCliente", "TelefonoWhatsApp", "Direccion", "ReferenciaDomicilio"];

    if (obligatorios.some(c => !encabezados.includes(c))) {

      errorHttp("Faltan columnas en el Excel; no se creó carpeta", 409);

    }


    etapa = "verificar_carpetas";

    const raiz = await obtenerRaiz(token);

    const existentes = await buscarCarpetaPorNumero(token, raiz, id);

    let carpeta: { id: string; name?: string };

    if (recuperando) {
      // Solo para la solicitud 8: reutilizar una carpeta exacta o crearla si no existe.
      // Si hay nombres distintos o duplicados, detenerse para revisión manual.
      if (existentes.length > 1) {
        errorHttp("Hay varias carpetas con el ID 00055. Revisión manual.", 409);
      }
      if (existentes.length === 1) {
        if (existentes[0].name !== carpetaNombre) {
          errorHttp("La carpeta 00055 tiene un nombre distinto. Revisión manual.", 409);
        }
        carpeta = existentes[0];
      } else {
        carpeta = { id: "" };
      }
    } else {

      if (existentes.length) {

        console.error("VIPACK carpeta en conflicto", { id, carpetas: existentes });

        errorHttp(`Existe carpeta ${numero(id)} en OneDrive. Revisión manual.`, 409);

      }

      // Se asignará después de verificar la versión del Excel.

      carpeta = { id: "" };

    }

    // Validar versión antes de crear o reutilizar carpeta. No reintentar ciegamente

    // después de crearla: el resultado remoto puede ser incierto.

    const versionActual = await obtenerVersionExcel(token);

    if (versionActual.etag !== version.etag || versionActual.id !== version.id) {

      errorHttp("El Excel cambió mientras se aprobaba; reintenta tras revisar", 409);

    }

    if (!carpeta.id) {

      etapa = "crear_carpeta";

      const nuevaCarpeta = await crearCarpeta(token, raiz, carpetaNombre);

      if (!nuevaCarpeta?.id) errorHttp("OneDrive no devolvió ID de carpeta; revisión manual", 502);

      carpeta = { id: String(nuevaCarpeta.id), name: carpetaNombre };

    }

    if (!carpeta.id) errorHttp("No se obtuvo el ID de la carpeta", 502);

    etapa = "subir_excel";

    // Mantener columnas y hojas existentes; agregar solo fila nueva.

    const nuevaFila: Fila = {

      "ID Cliente": id, Nombre: nombre, CarpetaCliente: carpetaNombre,

      TelefonoWhatsApp: tel, Direccion: limpiar(s.direccion),

      ReferenciaDomicilio: limpiar(s.referencia_domicilio),

    };

    XLSX.utils.sheet_add_json(hoja, [nuevaFila], {

      skipHeader: true, origin: -1, header: encabezados,

    });

    forzarTelefonosTexto(hoja);

    const nuevoExcel = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await subirExcel(token, version.id, version.etag, Buffer.from(nuevoExcel));

    etapa = "crear_inventario";

    const tokenInventario = randomUUID();

    const { error: eInventario } = await supabase.from("clientes_inventario").insert({

      id_cliente: id, nombre, carpeta_cliente: carpetaNombre,
      telefono_whatsapp: tel,

      onedrive_folder_id: String(carpeta.id), token_inventario: tokenInventario,

      activo: true, updated_at: new Date().toISOString(),

    });

    if (eInventario) errorHttp(`Excel y carpeta creados, pero falló inventario: ${eInventario.message}`, 500);

    etapa = "confirmar_solicitud";

    const { data: aprobadas, error: eAprobar } = await supabase.from("solicitudes_clientes").update({

      estado: "aprobado", id_cliente_asignado: id,

      carpeta_cliente: carpetaNombre, onedrive_folder_id: String(carpeta.id),

      updated_at: new Date().toISOString(),

    }).eq("id", solicitudId).eq("estado", "procesando")

      .eq("id_cliente_asignado", id).select("id");

    if (eAprobar || aprobadas?.length !== 1) {

      errorHttp(`Inventario creado, pero no se confirmó exactamente una solicitud: ${eAprobar?.message || "revisar estado"}`, 500);

    }

    etapa = "confirmar_reserva";

    const { data: confirmadas, error: eConfirmar } = await supabase.from("reservas_numeros_clientes")

      .update({ estado: "confirmado" })

      .eq("solicitud_id", solicitudId).eq("id_cliente", id)

      .eq("estado", "reservado").select("solicitud_id");

    if (eConfirmar || confirmadas?.length !== 1) {

      errorHttp(`Cliente aprobado, pero no se confirmó exactamente una reserva: ${eConfirmar?.message || "revisar reserva"}`, 500);

    }

    etapa = "liberar_bloqueo";

    const { data: liberados, error: eLiberar } = await supabase

      .from("vipack_bloqueo_aprobaciones")

      .delete().eq("id", 1).eq("token", bloqueoToken).select("id");

    if (eLiberar || liberados?.length !== 1) {

      errorHttp(`Cliente aprobado, pero el bloqueo requiere revisión: ${eLiberar?.message || "no se liberó"}`, 500);

    }

    bloqueoAdquirido = false;

    // Sincronización secundaria: solo después de finalizar la aprobación.
    // No alterar ni revertir una aprobación exitosa si falla Remisiones.
    let advertenciaRemisiones: string | null = null;
    const domicilioRemisiones = {
      calle: limpiar(s.calle) || null,
      numero_exterior: limpiar(s.numero_exterior) || null,
      numero_interior: limpiar(s.numero_interior) || null,
      colonia: limpiar(s.colonia) || null,
      delegacion: limpiar(s.delegacion) || null,
      codigo_postal: limpiar(s.codigo_postal) || null,
      ciudad: limpiar(s.ciudad) || null,
      estado: limpiar(s.estado_domicilio) || null,
    };
    if (Object.values(domicilioRemisiones).some(Boolean)) {
      try {
        const { error: eDireccion } = await supabase
          .from("remisiones_direcciones")
          .upsert({ id_cliente: id, ...domicilioRemisiones }, { onConflict: "id_cliente" });
        if (eDireccion) throw new Error(eDireccion.message);
      } catch (e: unknown) {
        advertenciaRemisiones = "Cliente aprobado, pero no se pudo sincronizar su domicilio con Remisiones.";
        console.error("VIPACK sincronización Remisiones pendiente", {
          solicitudId, idCliente: id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({

      success: true,
      ...(advertenciaRemisiones ? { advertencia: advertenciaRemisiones } : {}),
      cliente: {

        id_cliente: id, nombre, telefono: tel, direccion: s.direccion,

        referencia_domicilio: s.referencia_domicilio,

        carpeta_cliente: carpetaNombre, onedrive_folder_id: String(carpeta.id),

        token_inventario: tokenInventario,

      },

    });

  } catch (error: unknown) {

    const e = error as Error & { status?: number };

    console.error("VIPACK aprobación requiere revisión", { etapa, idAsignado, error: e.message });

    return NextResponse.json({

      success: false, error: e.message || "Error desconocido",

      etapa, id_cliente: idAsignado,

      requiere_revision: bloqueoAdquirido || idAsignado !== null,

    }, { status: e.status || 500 });

  }

}