import { leerExcelRecoleccionesSeguro } from "./recolecciones-excel-seguro";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const RUTA_FOTOS = "Envios/Recoleccion por cliente";
const RUTA_EXCEL = "Envios/control_recolecciones_bodega.xlsx";
const HOJA_SOLICITUDES = "Solicitudes";

type CarpetaOneDrive = { id: string; nombre: string };
type ArchivoOneDrive = { id: string; nombre: string; tamaño: number; webUrl: string | null; modificado: string | null };
type ArchivoSubido = { id: string; nombre: string; tamaño: number; webUrl: string | null };

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function crearSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Faltan variables de configuraciÃ³n de Supabase."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function renovarTokenOneDrive(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const response =
    await fetch(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              "refresh_token",

            refresh_token:
              refreshToken,

            scope:
              "openid profile offline_access User.Read Files.ReadWrite",
          }),

        cache:
          "no-store",
      }
    );

  const data =
    await leerJsonSeguro(
      response
    );

  return {
    response,
    data,
  };
}

export async function obtenerAccessToken() {
  const clientId =
    process.env.ONEDRIVE_CLIENT_ID;

  const clientSecret =
    process.env.ONEDRIVE_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Faltan variables de configuraciÃ³n de OneDrive."
    );
  }

  const supabase =
    crearSupabase();

  const {
    data: conexion,
    error,
  } = await supabase
    .from("onedrive_connections")
    .select(
      "id, refresh_token"
    )
    .order(
      "id",
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la conexiÃ³n de OneDrive: ${error.message}`
    );
  }

  if (
    !conexion?.refresh_token
  ) {
    throw new Error(
      "No existe una conexiÃ³n activa de OneDrive."
    );
  }

  const {
    response,
    data,
  } =
    await renovarTokenOneDrive(
      clientId,
      clientSecret,
      conexion.refresh_token
    );

  if (!response.ok) {
    throw new Error(
      data
        ?.error_description ||
        data?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken =
    data?.access_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolviÃ³ access_token."
    );
  }

  const newRefreshToken =
    data?.refresh_token;

  if (
    newRefreshToken &&
    newRefreshToken !==
      conexion.refresh_token
  ) {
    const {
      error:
        updateError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
      .update({
        refresh_token:
          newRefreshToken,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        conexion.id
      );

    if (updateError) {
      console.error(
        "No se pudo actualizar refresh_token:",
        updateError
      );
    }
  }

  return accessToken;
}


function normalizarNombre(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase(
      "es"
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function quitarCodigoInicial(
  valor: string
) {
  return valor
    .replace(
      /^\d+\s*/,
      ""
    )
    .trim();
}

async function descargarExcel(
  accessToken: string
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  if (!response.ok) {
    const detalle =
      await response.text();

    throw new Error(
      `No se pudo leer el Excel de recolecciones. ${detalle}`
    );
  }

  return await leerExcelRecoleccionesSeguro(response);
}

async function obtenerClientePorFolio(
  accessToken: string,
  folio: string
) {
  const arrayBuffer =
    await descargarExcel(
      accessToken
    );

  const workbook =
    XLSX.read(
      Buffer.from(
        arrayBuffer
      ),
      {
        type:
          "buffer",
      }
    );

  const hoja =
    workbook.Sheets[
      HOJA_SOLICITUDES
    ];

  if (!hoja) {
    throw new Error(
      `El Excel no contiene la hoja "${HOJA_SOLICITUDES}".`
    );
  }

  const filas =
    XLSX.utils
      .sheet_to_json<
        Record<
          string,
          unknown
        >
      >(
        hoja,
        {
          defval:
            "",
          raw:
            false,
        }
      );

  const fila =
    filas.find(
      (item) =>
        String(
          item.Folio ?? ""
        ).trim() ===
        folio
    );

  if (!fila) {
    throw new Error(
      `No se encontrÃ³ el folio ${folio} en el Excel de recolecciones.`
    );
  }

  const cliente =
    String(
      fila.Cliente ?? ""
    ).trim();

  if (!cliente) {
    throw new Error(
      `La recolecciÃ³n ${folio} no tiene cliente asignado.`
    );
  }

  return cliente;
}

async function listarCarpetas(
  accessToken: string,
  ruta: string
): Promise<CarpetaOneDrive[]> {
  const inicial =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(ruta)}:/children?$select=id,name,folder&$top=999`;

  let siguiente: string | null = inicial;
  const carpetas: CarpetaOneDrive[] = [];
  const visitadas = new Set<string>();
  let paginas = 0;

  while (siguiente) {
    if (visitadas.has(siguiente) || paginas >= 100) {
      throw new Error("Paginacion de OneDrive incompleta o repetida.");
    }

    const url = new URL(siguiente);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "graph.microsoft.com" ||
      !url.pathname.startsWith("/v1.0/")
    ) {
      throw new Error("Enlace de paginacion de OneDrive invalido.");
    }

    visitadas.add(siguiente);
    paginas++;

    const response = await fetch(siguiente, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error(`No existe la carpeta de OneDrive: ${ruta}.`);
    }

    const data = await leerJsonSeguro(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `No se pudo leer la carpeta ${ruta}.`
      );
    }

    if (!Array.isArray(data?.value)) {
      throw new Error("Respuesta de carpetas de OneDrive invalida.");
    }

    for (const item of data.value) {
      if (item?.folder) {
        carpetas.push({
          id: String(item.id || ""),
          nombre: String(item.name || ""),
        });
      }
    }

    const enlace = data["@odata.nextLink"];

    if (enlace != null && typeof enlace !== "string") {
      throw new Error("Enlace de paginacion invalido.");
    }

    siguiente = enlace || null;
  }

  return carpetas;
}
async function resolverCarpetaCliente(
  accessToken: string,
  cliente: string
) {
  const carpetas =
    await listarCarpetas(
      accessToken,
      RUTA_FOTOS
    );

  const objetivo =
    normalizarNombre(
      cliente
    );

  /*
   * Tus carpetas pueden traer un cÃ³digo
   * delante, por ejemplo:
   * "00018 Nombre del cliente".
   */
  const preparadas =
    carpetas.map(
      (carpeta) => {
        const nombreNormal =
          normalizarNombre(
            carpeta.nombre
          );

        const sinCodigo =
          quitarCodigoInicial(
            nombreNormal
          );

        return {
          ...carpeta,
          nombreNormal,
          sinCodigo,
        };
      }
    );

  const exactas = preparadas.filter(
    (carpeta) =>
      carpeta.sinCodigo === objetivo ||
      carpeta.nombreNormal === objetivo
  );

  if (exactas.length === 1) {
    return exactas[0];
  }

  if (exactas.length > 1) {
    throw new Error(
      `Existen varias carpetas con el nombre del cliente "${cliente}". Se requiere identificar la carpeta correcta.`
    );
  }

  throw new Error(
    `No se encontro una carpeta con coincidencia exacta para "${cliente}" dentro de "${RUTA_FOTOS}". No se subio ninguna fotografia.`
  );
}

export async function resolverRutaFotosCliente(
  accessToken: string,
  folio: string
) {
  const cliente =
    await obtenerClientePorFolio(
      accessToken,
      folio
    );

  const carpeta =
    await resolverCarpetaCliente(
      accessToken,
      cliente
    );

  return {
    cliente,

    carpeta:
      carpeta.nombre,

    ruta:
      `${RUTA_FOTOS}/${carpeta.nombre}`,
  };
}

export async function listarArchivosCarpeta(
  accessToken: string,
  ruta: string
): Promise<ArchivoOneDrive[]> {
  const inicial =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(ruta)}:/children?$select=id,name,size,file,webUrl,lastModifiedDateTime&$top=999`;

  let siguiente: string | null = inicial;
  const archivos: ArchivoOneDrive[] = [];
  const visitadas = new Set<string>();
  let paginas = 0;

  while (siguiente) {
    if (visitadas.has(siguiente) || paginas >= 100) {
      throw new Error("Paginacion de archivos incompleta o repetida.");
    }

    const url = new URL(siguiente);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "graph.microsoft.com" ||
      !url.pathname.startsWith("/v1.0/")
    ) {
      throw new Error("Enlace de paginacion de archivos invalido.");
    }

    visitadas.add(siguiente);
    paginas++;

    const response = await fetch(siguiente, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      throw new Error(`No existe la carpeta: ${ruta}.`);
    }

    const data = await leerJsonSeguro(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `No se pudieron consultar los archivos de ${ruta}.`
      );
    }

    if (!Array.isArray(data?.value)) {
      throw new Error("Respuesta de archivos de OneDrive invalida.");
    }

    for (const item of data.value) {
      if (item?.file) {
        archivos.push({
          id: String(item.id || ""),
          nombre: String(item.name || ""),
          tamaño: Number(item.size || 0),
          webUrl: item.webUrl ? String(item.webUrl) : null,
          modificado: item.lastModifiedDateTime
            ? String(item.lastModifiedDateTime)
            : null,
        });
      }
    }

    const enlace = data["@odata.nextLink"];

    if (enlace != null && typeof enlace !== "string") {
      throw new Error("Enlace de paginacion invalido.");
    }

    siguiente = enlace || null;
  }

  return archivos;
}
function perteneceAlFolio(
  nombre: string,
  folio: string
) {
  return nombre
    .toLowerCase()
    .startsWith(
      folio.toLowerCase()
    );
}

export async function subirArchivo(
  accessToken: string,
  ruta: string,
  archivo: File,
  nombreFinal: string
): Promise<ArchivoSubido> {
  if (!archivo.size || archivo.size > 8 * 1024 * 1024) {
    throw new Error("Tamano de fotografia invalido.");
  }

  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      `${ruta}/${nombreFinal}`
    )}:/createUploadSession`;

  const sesion = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "fail",
        name: nombreFinal,
      },
    }),
    cache: "no-store",
  });

  const datosSesion = await leerJsonSeguro(sesion);

  if (!sesion.ok) {
    if (sesion.status === 409) {
      throw new Error("La fotografia ya existe en OneDrive.");
    }

    throw new Error(
      `No se pudo crear la sesion de carga. HTTP ${sesion.status}.`
    );
  }

  if (typeof datosSesion?.uploadUrl !== "string") {
    throw new Error("OneDrive no devolvio una URL de carga.");
  }

  const destino = new URL(datosSesion.uploadUrl);

  if (
    destino.protocol !== "https:" ||
    destino.username !== "" ||
    destino.password !== "" ||
    destino.port !== ""
  ) {
    throw new Error("URL de carga no segura.");
  }

  const contenido = await archivo.arrayBuffer();

  const respuesta = await fetch(datosSesion.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(contenido.byteLength),
      "Content-Range":
        `bytes 0-${contenido.byteLength - 1}/${contenido.byteLength}`,
    },
    body: contenido,
    cache: "no-store",
    redirect: "error",
  });

  const data = await leerJsonSeguro(respuesta);

  if (!respuesta.ok) {
    if (respuesta.status === 409) {
      throw new Error("La fotografia ya existe en OneDrive.");
    }

    throw new Error(
      `No se pudo completar la subida. HTTP ${respuesta.status}.`
    );
  }

  if (
    typeof data?.id !== "string" ||
    !data.id.trim() ||
    typeof data?.name !== "string" ||
    data.name !== nombreFinal ||
    typeof data?.size !== "number" ||
    data.size !== archivo.size
  ) {
    throw new Error(
      "OneDrive no confirmo correctamente la fotografia subida."
    );
  }

  return {
    id: data.id,
    nombre: data.name,
    webUrl: data.webUrl || null,
    tamaño: data.size,
  };
}

export function nombreFotoAndroid(
  folio: string,
  photoId: string,
  extension: string = "jpg"
): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(folio)) {
    throw new Error("Folio invalido.");
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photoId)
  ) {
    throw new Error("Identificador de fotografia invalido.");
  }

  const ext = extension.toLowerCase().replace(/^\./, "");

  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new Error("Extension de fotografia no permitida.");
  }

  return `${folio}.Foto-APP-${photoId.toLowerCase()}.${ext}`;
}

export async function buscarFotoAndroidExistente(
  accessToken: string,
  ruta: string,
  nombreFinal: string
): Promise<ArchivoOneDrive | null> {
  const archivos = await listarArchivosCarpeta(
    accessToken,
    ruta
  );

  const nombreNormalizado = nombreFinal.toLowerCase();

  const prefijoFoto = nombreNormalizado.replace(
    /\.(jpg|jpeg|png|webp)$/,
    "."
  );

  if (prefijoFoto === nombreNormalizado) {
    throw new Error("Extension de fotografia invalida.");
  }

  const coincidencias = archivos.filter((archivo) => {
    const nombre = archivo.nombre.toLowerCase();

    return (
      nombre.startsWith(prefijoFoto) &&
      /\.(jpg|jpeg|png|webp)$/.test(nombre)
    );
  });

  if (coincidencias.length > 1) {
    throw new Error(
      "Se encontraron varias fotografias con el mismo nombre."
    );
  }

  return coincidencias[0] || null;
}

export async function descargarFotoAndroidExistente(
  accessToken: string,
  archivoId: string
): Promise<ArrayBuffer> {
  if (!archivoId || !archivoId.trim()) {
    throw new Error("Identificador de archivo invalido.");
  }

  const limite = 8 * 1024 * 1024;

  const url =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(archivoId)}/content`;

  const respuestaGraph = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    redirect: "manual",
  });

  let response: Response;

  if (
    respuestaGraph.status === 301 ||
    respuestaGraph.status === 302 ||
    respuestaGraph.status === 303 ||
    respuestaGraph.status === 307 ||
    respuestaGraph.status === 308
  ) {
    const ubicacion = respuestaGraph.headers.get("location");

    if (!ubicacion) {
      throw new Error("OneDrive no devolvio la direccion de descarga.");
    }

    const destino = new URL(ubicacion);

    const hostname = destino.hostname.toLowerCase();

    const permitido =
      hostname === "my.microsoftpersonalcontent.com" ||
      hostname === "onedrive.live.com" ||
      hostname === "storage.live.com" ||
      hostname.endsWith(".files.1drv.com");

    if (
      destino.protocol !== "https:" ||
      destino.username !== "" ||
      destino.password !== "" ||
      destino.port !== "" ||
      !permitido
    ) {
      throw new Error(
        "OneDrive devolvio un destino de descarga no autorizado."
      );
    }

    response = await fetch(destino.toString(), {
      cache: "no-store",
      redirect: "error",
    });
  } else {
    response = respuestaGraph;
  }

  if (!response.ok) {
    throw new Error(
      "No se pudo descargar la fotografia existente de OneDrive."
    );
  }

  if (!response.body) {
    throw new Error("OneDrive no devolvio contenido.");
  }

  const lector = response.body.getReader();
  const fragmentos: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await lector.read();

      if (done) break;

      total += value.byteLength;

      if (total > limite) {
        await lector.cancel();
        throw new Error(
          "La fotografia existente supera el limite de 8 MB."
        );
      }

      fragmentos.push(value);
    }
  } finally {
    lector.releaseLock();
  }

  const resultado = new Uint8Array(total);
  let posicion = 0;

  for (const fragmento of fragmentos) {
    resultado.set(fragmento, posicion);
    posicion += fragmento.byteLength;
  }

  return resultado.buffer;
}

export async function compararFotoAndroidExistente(
  accessToken: string,
  archivoId: string,
  archivoNuevo: File
): Promise<boolean> {
  const { createHash } = await import("node:crypto");

  const limite = 8 * 1024 * 1024;

  if (
    archivoNuevo.size < 1 ||
    archivoNuevo.size > limite
  ) {
    throw new Error("Tamano de fotografia invalido.");
  }

  const contenidoExistente =
    await descargarFotoAndroidExistente(
      accessToken,
      archivoId
    );

  if (contenidoExistente.byteLength !== archivoNuevo.size) {
    return false;
  }

  const contenidoNuevo = await archivoNuevo.arrayBuffer();

  const hashExistente = createHash("sha256")
    .update(Buffer.from(contenidoExistente))
    .digest("hex");

  const hashNuevo = createHash("sha256")
    .update(Buffer.from(contenidoNuevo))
    .digest("hex");

  return hashExistente === hashNuevo;
}

export async function consultarDominioDescargaOneDrive(
  accessToken: string,
  archivoId: string
): Promise<string> {
  if (!archivoId || !archivoId.trim()) {
    throw new Error("Identificador de archivo invalido.");
  }

  const url =
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(archivoId)}/content`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    redirect: "manual",
  });

  if (
    response.status !== 301 &&
    response.status !== 302 &&
    response.status !== 303 &&
    response.status !== 307 &&
    response.status !== 308
  ) {
    throw new Error(
      `Microsoft Graph no devolvio una redireccion. Estado: ${response.status}`
    );
  }

  const ubicacion = response.headers.get("location");

  if (!ubicacion) {
    throw new Error("Microsoft Graph no devolvio ubicacion.");
  }

  const destino = new URL(ubicacion);

  if (destino.protocol !== "https:") {
    throw new Error("La descarga no utiliza HTTPS.");
  }

  return destino.hostname.toLowerCase();
}