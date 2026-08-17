import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !clientId ||
      !clientSecret ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faltan variables de configuración de OneDrive o Supabase.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * 1. Obtener conexión guardada
     */
    const { data: conexion, error: connectionError } =
      await supabase
        .from("onedrive_connections")
        .select("id, drive_id, refresh_token")
        .order("id", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (connectionError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo consultar la conexión de OneDrive.",
          detalle: connectionError.message,
        },
        { status: 500 }
      );
    }

    if (!conexion?.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No existe una conexión activa de OneDrive.",
        },
        { status: 400 }
      );
    }

    /*
     * 2. Renovar access token
     */
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

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData?.error_description ||
            tokenData?.error ||
            tokenData,
        },
        { status: 400 }
      );
    }

    const accessToken = tokenData?.access_token;
    const newRefreshToken = tokenData?.refresh_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Microsoft no devolvió access_token.",
        },
        { status: 400 }
      );
    }

    /*
     * Microsoft puede rotar refresh_token
     */
    if (
      newRefreshToken &&
      newRefreshToken !== conexion.refresh_token
    ) {
      await supabase
        .from("onedrive_connections")
        .update({
          refresh_token: newRefreshToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conexion.id);
    }

    /*
     * 3. Leer carpetas reales
     */
    const ruta = "Envios/Recoleccion por cliente";

    const graphUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        ruta
      )}:/children?$select=id,name,folder&$top=999`;

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron leer las carpetas de clientes en OneDrive.",
          detalle: data,
        },
        { status: 400 }
      );
    }

    const carpetas = Array.isArray(data?.value)
      ? data.value.filter((item: any) =>
          Boolean(item?.folder)
        )
      : [];

    /*
     * 4. Obtener clientes Supabase
     */
    const { data: clientes, error: clientesError } =
      await supabase
        .from("clientes_inventario")
        .select(
          "id, id_cliente, nombre, carpeta_cliente, onedrive_folder_id"
        )
        .order("id_cliente", {
          ascending: true,
        });

    if (clientesError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron consultar los clientes en Supabase.",
          detalle: clientesError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Normalización mínima:
     * trim + minúsculas.
     * No modificamos datos guardados.
     */
    const normalizar = (valor: unknown) =>
      String(valor || "")
        .trim()
        .toLocaleLowerCase("es");

    const resultados: any[] = [];

    /*
     * 5. Sincronizar
     *
     * PRIORIDAD:
     * A) buscar por prefijo 00001, 00002...
     * B) si no encuentra, comparar nombre completo
     */
    for (const cliente of clientes || []) {
      const prefijo = String(
        cliente.id_cliente
      ).padStart(5, "0");

      const nombreEsperado = normalizar(
        cliente.carpeta_cliente
      );

      /*
       * A. Buscar por número de cliente
       */
      const coincidenciasPorId = carpetas.filter(
        (carpeta: any) => {
          const nombre = String(
            carpeta.name || ""
          ).trim();

          return (
            nombre === prefijo ||
            nombre.startsWith(`${prefijo} `)
          );
        }
      );

      let carpetaEncontrada: any | null = null;

      let metodo:
        | "id_cliente"
        | "nombre_exacto"
        | null = null;

      /*
       * Solo aceptamos coincidencia por ID
       * si existe exactamente una carpeta.
       */
      if (coincidenciasPorId.length === 1) {
        carpetaEncontrada =
          coincidenciasPorId[0];

        metodo = "id_cliente";
      }

      /*
       * B. Respaldo:
       * coincidencia por nombre completo
       */
      if (!carpetaEncontrada) {
        const coincidenciasNombre =
          carpetas.filter(
            (carpeta: any) =>
              normalizar(carpeta.name) ===
              nombreEsperado
          );

        if (coincidenciasNombre.length === 1) {
          carpetaEncontrada =
            coincidenciasNombre[0];

          metodo = "nombre_exacto";
        }
      }

      /*
       * Duplicado en OneDrive.
       * NO elegimos una carpeta automáticamente.
       */
      if (coincidenciasPorId.length > 1) {
        resultados.push({
          id_cliente: cliente.id_cliente,
          nombre: cliente.nombre,
          carpeta_cliente:
            cliente.carpeta_cliente,
          estado: "duplicado_onedrive",
          coincidencias:
            coincidenciasPorId.map(
              (item: any) => ({
                id: item.id,
                nombre: item.name,
              })
            ),
        });

        continue;
      }

      /*
       * Sin carpeta encontrada
       */
      if (!carpetaEncontrada) {
        resultados.push({
          id_cliente: cliente.id_cliente,
          nombre: cliente.nombre,
          carpeta_cliente:
            cliente.carpeta_cliente,
          prefijo_buscado: prefijo,
          estado: "sin_coincidencia",
        });

        continue;
      }

      /*
       * Ya estaba sincronizado
       */
      if (
        cliente.onedrive_folder_id ===
        carpetaEncontrada.id
      ) {
        resultados.push({
          id_cliente: cliente.id_cliente,
          nombre: cliente.nombre,
          carpeta_cliente:
            cliente.carpeta_cliente,
          carpeta_onedrive:
            carpetaEncontrada.name,
          onedrive_folder_id:
            carpetaEncontrada.id,
          metodo,
          estado: "ya_sincronizado",
        });

        continue;
      }

      /*
       * Guardar folder ID
       */
      const { error: updateError } =
        await supabase
          .from("clientes_inventario")
          .update({
            onedrive_folder_id:
              carpetaEncontrada.id,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", cliente.id);

      if (updateError) {
        resultados.push({
          id_cliente: cliente.id_cliente,
          nombre: cliente.nombre,
          carpeta_cliente:
            cliente.carpeta_cliente,
          estado: "error",
          error: updateError.message,
        });

        continue;
      }

      resultados.push({
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        carpeta_cliente:
          cliente.carpeta_cliente,
        carpeta_onedrive:
          carpetaEncontrada.name,
        onedrive_folder_id:
          carpetaEncontrada.id,
        metodo,
        estado: "sincronizado",
      });
    }

    /*
     * 6. Resumen
     */
    const resumen = {
      total_clientes: resultados.length,

      sincronizados: resultados.filter(
        (item) =>
          item.estado === "sincronizado"
      ).length,

      ya_sincronizados: resultados.filter(
        (item) =>
          item.estado === "ya_sincronizado"
      ).length,

      sin_coincidencia: resultados.filter(
        (item) =>
          item.estado === "sin_coincidencia"
      ).length,

      duplicados_onedrive:
        resultados.filter(
          (item) =>
            item.estado ===
            "duplicado_onedrive"
        ).length,

      errores: resultados.filter(
        (item) => item.estado === "error"
      ).length,

      carpetas_onedrive: carpetas.length,
    };

    /*
     * 7. Respuesta
     *
     * También devolvemos las carpetas detectadas
     * para poder revisar los 31 clientes
     * sin coincidencia.
     */
    return NextResponse.json({
      success: true,
      resumen,
      resultados,

      carpetas_detectadas: carpetas.map(
        (carpeta: any) => ({
          id: carpeta.id,
          nombre: carpeta.name,
        })
      ),
    });
  } catch (error: unknown) {
    console.error(
      "Error sync clientes OneDrive:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}