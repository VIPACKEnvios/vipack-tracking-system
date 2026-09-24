import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const RUTA_EXCEL = "Envios/Paquetes_USA.xlsx";
const HOJA_PAQUETES = "Paquetes_USA";

/* =========================================================
   SUPABASE
========================================================= */

function crearSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan variables de Supabase.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/* =========================================================
   UTILIDADES
========================================================= */

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

async function leerJsonSeguro(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function valorCelda(
  hoja: XLSX.WorkSheet,
  columna: string,
  fila: number
) {
  return hoja[`${columna}${fila}`]?.v;
}

function escribirCelda(
  hoja: XLSX.WorkSheet,
  direccion: string,
  valor: string | number
) {
  hoja[direccion] = {
    t: typeof valor === "number" ? "n" : "s",
    v: valor,
  };
}

function asegurarRango(
  hoja: XLSX.WorkSheet,
  fila: number,
  ultimaColumna: number
) {
  const actual = XLSX.utils.decode_range(
    hoja["!ref"] || "A1:A1"
  );

  actual.e.r = Math.max(actual.e.r, fila - 1);
  actual.e.c = Math.max(actual.e.c, ultimaColumna);

  hoja["!ref"] = XLSX.utils.encode_range(actual);
}

function siguienteFilaLibre(hoja: XLSX.WorkSheet) {
  const rango = XLSX.utils.decode_range(
    hoja["!ref"] || "A1:A1"
  );

  for (
    let fila = 2;
    fila <= rango.e.r + 2;
    fila += 1
  ) {
    const valor = valorCelda(hoja, "A", fila);

    if (
      valor === undefined ||
      valor === null ||
      texto(valor) === ""
    ) {
      return fila;
    }
  }

  return rango.e.r + 2;
}

/* =========================================================
   FECHA TIJUANA
========================================================= */

function fechaTijuana() {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Tijuana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* =========================================================
   ONEDRIVE
========================================================= */

async function obtenerAccessToken() {
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan variables de configuración de OneDrive."
    );
  }

  const supabase = crearSupabase();

  const { data: conexion, error } = await supabase
    .from("onedrive_connections")
    .select("id, refresh_token")
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar OneDrive: ${error.message}`
    );
  }

  if (!conexion?.refresh_token) {
    throw new Error(
      "No existe una conexión activa de OneDrive."
    );
  }

  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: conexion.refresh_token,
        scope:
          "openid profile offline_access User.Read Files.ReadWrite",
      }),

      cache: "no-store",
    }
  );

  const tokenData = await leerJsonSeguro(tokenResponse);

  if (!tokenResponse.ok) {
    throw new Error(
      tokenData?.error_description ||
        tokenData?.error ||
        "No se pudo renovar el acceso a OneDrive."
    );
  }

  const accessToken = tokenData?.access_token;

  if (!accessToken) {
    throw new Error(
      "Microsoft no devolvió access_token."
    );
  }

  const nuevoRefreshToken = tokenData?.refresh_token;

  if (
    nuevoRefreshToken &&
    nuevoRefreshToken !== conexion.refresh_token
  ) {
    const { error: updateError } = await supabase
      .from("onedrive_connections")
      .update({
        refresh_token: nuevoRefreshToken,
        updated_at: new Date().toISOString(),
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

/* =========================================================
   EXCEL ONEDRIVE
========================================================= */

async function descargarExcel(accessToken: string) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detalle = await response.text();

    throw new Error(
      `No se pudo descargar Paquetes_USA.xlsx. ${detalle}`
    );
  }

  return await response.arrayBuffer();
}

async function subirExcel(
  accessToken: string,
  buffer: Buffer
) {
  const url =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
      RUTA_EXCEL
    )}:/content`;

  const response = await fetch(url, {
    method: "PUT",

    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },

    body: new Uint8Array(buffer),

    cache: "no-store",
  });

  if (!response.ok) {
    const detalle = await response.text();

    throw new Error(
      `No se pudo actualizar Paquetes_USA.xlsx. ${detalle}`
    );
  }
}

/* =========================================================
   CLIENTE
========================================================= */

async function obtenerCliente(token: string) {
  const supabase = crearSupabase();

  const { data: cliente, error } = await supabase
    .from("clientes_inventario")
    .select(
      "id_cliente, nombre, token_inventario, activo"
    )
    .eq("token_inventario", token)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el cliente: ${error.message}`
    );
  }

  return cliente;
}

/* =========================================================
   GET
   LISTAR PAQUETES DEL CLIENTE
========================================================= */

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el token del cliente.",
        },
        {
          status: 400,
        }
      );
    }

    const cliente = await obtenerCliente(token);

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o inventario inactivo.",
        },
        {
          status: 404,
        }
      );
    }

    const accessToken = await obtenerAccessToken();

    const arrayBuffer =
      await descargarExcel(accessToken);

    const workbook = XLSX.read(
      Buffer.from(arrayBuffer),
      {
        type: "buffer",
        cellFormula: true,
        cellStyles: true,
      }
    );

    const hoja =
      workbook.Sheets[HOJA_PAQUETES];

    if (!hoja) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No existe la hoja "${HOJA_PAQUETES}" dentro de Paquetes_USA.xlsx.`,
        },
        {
          status: 400,
        }
      );
    }

    const rango = XLSX.utils.decode_range(
      hoja["!ref"] || "A1:I1"
    );

    const paquetes = [];

    for (
      let fila = 2;
      fila <= rango.e.r + 1;
      fila += 1
    ) {
      const tokenFila = texto(
        valorCelda(hoja, "C", fila)
      );

      if (tokenFila !== token) {
        continue;
      }

      const id = texto(
        valorCelda(hoja, "A", fila)
      );

      if (!id) {
        continue;
      }

      paquetes.push({
        id,

        cliente: texto(
          valorCelda(hoja, "B", fila)
        ),

        rastreo: texto(
          valorCelda(hoja, "D", fila)
        ),

        tienda: texto(
          valorCelda(hoja, "E", fila)
        ),

        fechaRegistro: texto(
          valorCelda(hoja, "F", fila)
        ),

        estatus: texto(
          valorCelda(hoja, "G", fila)
        ),

        fechaRecibido: texto(
          valorCelda(hoja, "H", fila)
        ),

        fechaCompra: texto(
          valorCelda(hoja, "I", fila)
        ),
      });
    }

    paquetes.reverse();

    return NextResponse.json({
      success: true,

      cliente: {
        id: cliente.id_cliente,
        nombre: cliente.nombre,
      },

      paquetes,

      total: paquetes.length,
    });
  } catch (error) {
    console.error(
      "Error cargando paquetes:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido cargando paquetes.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   REGISTRAR PAQUETE
========================================================= */

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el token del cliente.",
        },
        {
          status: 400,
        }
      );
    }

    const cliente = await obtenerCliente(token);

    if (!cliente) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cliente no encontrado o inventario inactivo.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await request.json();

    const rastreo = texto(body?.rastreo);
    const tienda = texto(body?.tienda);
    const fechaCompra = texto(
      body?.fechaCompra
    );

    if (!rastreo) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El número de rastreo es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!tienda) {
      return NextResponse.json(
        {
          success: false,
          error: "La tienda es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await obtenerAccessToken();

    const arrayBuffer =
      await descargarExcel(accessToken);

    const workbook = XLSX.read(
      Buffer.from(arrayBuffer),
      {
        type: "buffer",
        cellFormula: true,
        cellStyles: true,
      }
    );

    const hoja =
      workbook.Sheets[HOJA_PAQUETES];

    if (!hoja) {
      throw new Error(
        `No existe la hoja "${HOJA_PAQUETES}" dentro de Paquetes_USA.xlsx.`
      );
    }

    /* Evitar rastreo duplicado para el mismo cliente */

    const rango = XLSX.utils.decode_range(
      hoja["!ref"] || "A1:I1"
    );

    for (
      let fila = 2;
      fila <= rango.e.r + 1;
      fila += 1
    ) {
      const tokenExistente = texto(
        valorCelda(hoja, "C", fila)
      );

      const rastreoExistente = texto(
        valorCelda(hoja, "D", fila)
      );

      if (
        tokenExistente === token &&
        rastreoExistente.toLowerCase() ===
          rastreo.toLowerCase()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Este número de rastreo ya está registrado.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const fila =
      siguienteFilaLibre(hoja);

    const id =
      `PKG-${Date.now()}`;

    const fechaRegistro =
      fechaTijuana();

    /*
      A = ID
      B = Cliente
      C = TokenCliente
      D = Rastreo
      E = Tienda
      F = FechaRegistro
      G = Estatus
      H = FechaRecibido
      I = FechaCompra
    */

    escribirCelda(
      hoja,
      `A${fila}`,
      id
    );

    escribirCelda(
      hoja,
      `B${fila}`,
      cliente.nombre
    );

    escribirCelda(
      hoja,
      `C${fila}`,
      token
    );

    escribirCelda(
      hoja,
      `D${fila}`,
      rastreo
    );

    escribirCelda(
      hoja,
      `E${fila}`,
      tienda
    );

    escribirCelda(
      hoja,
      `F${fila}`,
      fechaRegistro
    );

    escribirCelda(
      hoja,
      `G${fila}`,
      "Registrado"
    );

    escribirCelda(
      hoja,
      `H${fila}`,
      ""
    );

    escribirCelda(
      hoja,
      `I${fila}`,
      fechaCompra
    );

    asegurarRango(
      hoja,
      fila,
      8
    );

    const salida = XLSX.write(
      workbook,
      {
        type: "buffer",
        bookType: "xlsx",
        cellStyles: true,
      }
    );

    await subirExcel(
      accessToken,
      salida
    );

    return NextResponse.json({
      success: true,

      paquete: {
        id,
        cliente: cliente.nombre,
        rastreo,
        tienda,
        fechaRegistro,
        estatus: "Registrado",
        fechaRecibido: "",
        fechaCompra,
      },

      mensaje:
        "Paquete registrado correctamente.",
    });
  } catch (error) {
    console.error(
      "Error registrando paquete:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Error desconocido registrando paquete.",
      },
      {
        status: 500,
      }
    );
  }
}