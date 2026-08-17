import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RUTA_CLIENTES =
  "Envios/Recoleccion por cliente";

type CarpetaOneDrive = {
  id: string;
  name: string;
  folder?: {
    childCount?: number;
  };
};

function normalizar(
  valor: unknown
) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function limpiarNombreCarpeta(
  valor: string
) {
  /*
   * OneDrive no admite:
   * " * : < > ? / \ |
   *
   * Tampoco conviene terminar
   * nombres con punto o espacios.
   */
  return valor
    .replace(
      /["*:<>?\/\\|]/g,
      "-"
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "")
    .slice(0, 180);
}

function nombreCarpetaEsperado(
  idCliente: number,
  nombre: string,
  carpetaCliente:
    | string
    | null
    | undefined
) {
  const prefijo =
    String(idCliente).padStart(
      5,
      "0"
    );

  const guardado =
    limpiarNombreCarpeta(
      String(
        carpetaCliente || ""
      )
    );

  /*
   * Si carpeta_cliente ya contiene
   * el número del cliente, la respetamos.
   */
  if (
    guardado === prefijo ||
    guardado.startsWith(
      `${prefijo} `
    )
  ) {
    return guardado;
  }

  const nombreLimpio =
    limpiarNombreCarpeta(
      nombre
    );

  return limpiarNombreCarpeta(
    `${prefijo} ${nombreLimpio}`
  );
}

async function leerJsonSeguro(
  response: Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const clientId =
      process.env.ONEDRIVE_CLIENT_ID;

    const clientSecret =
      process.env.ONEDRIVE_CLIENT_SECRET;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

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

    const supabase =
      createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,
            persistSession:
              false,
          },
        }
      );

    /*
     * 1. Obtener conexión guardada.
     */
    const {
      data: conexion,
      error: connectionError,
    } = await supabase
      .from(
        "onedrive_connections"
      )
      .select(
        "id, refresh_token"
      )
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
          detalle:
            connectionError.message,
        },
        { status: 500 }
      );
    }

    if (
      !conexion?.refresh_token
    ) {
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
     * 2. Renovar access_token.
     */
    const tokenResponse =
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
                conexion.refresh_token,

              scope:
                "openid profile offline_access User.Read Files.ReadWrite",
            }),

          cache:
            "no-store",
        }
      );

    const tokenData =
      await leerJsonSeguro(
        tokenResponse
      );

    if (
      !tokenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudo renovar el acceso a OneDrive.",
          detalle:
            tokenData
              ?.error_description ||
            tokenData?.error ||
            tokenData ||
            `HTTP ${tokenResponse.status}`,
        },
        { status: 400 }
      );
    }

    const accessToken =
      tokenData?.access_token;

    const newRefreshToken =
      tokenData?.refresh_token;

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
     * Microsoft puede rotar
     * el refresh_token.
     */
    if (
      newRefreshToken &&
      newRefreshToken !==
        conexion.refresh_token
    ) {
      const {
        error: updateTokenError,
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

      if (updateTokenError) {
        console.error(
          "No se pudo guardar refresh_token rotado:",
          updateTokenError
        );
      }
    }

    /*
     * 3. Obtener la carpeta raíz
     * "Envios/Recoleccion por cliente".
     *
     * Necesitamos su ID para poder
     * crear nuevas carpetas dentro.
     */
    const rootFolderUrl =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(
        RUTA_CLIENTES
      )}?$select=id,name,folder`;

    const rootResponse =
      await fetch(
        rootFolderUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const rootData =
      await leerJsonSeguro(
        rootResponse
      );

    if (
      !rootResponse.ok ||
      !rootData?.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se encontró la carpeta principal de clientes en OneDrive.",
          detalle:
            rootData ||
            `HTTP ${rootResponse.status}`,
          ruta:
            RUTA_CLIENTES,
        },
        { status: 400 }
      );
    }

    const rootFolderId =
      String(rootData.id);

    /*
     * 4. Leer carpetas existentes.
     */
    const childrenUrl =
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
        rootFolderId
      )}/children?$select=id,name,folder&$top=999`;

    const childrenResponse =
      await fetch(
        childrenUrl,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },

          cache:
            "no-store",
        }
      );

    const childrenData =
      await leerJsonSeguro(
        childrenResponse
      );

    if (
      !childrenResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron leer las carpetas de clientes en OneDrive.",
          detalle:
            childrenData ||
            `HTTP ${childrenResponse.status}`,
        },
        { status: 400 }
      );
    }

    const carpetas:
      CarpetaOneDrive[] =
      Array.isArray(
        childrenData?.value
      )
        ? childrenData.value.filter(
            (item: any) =>
              Boolean(
                item?.folder
              )
          )
        : [];

    /*
     * 5. Obtener clientes activos.
     *
     * token_inventario también se
     * incluye para generarlo cuando
     * un cliente nuevo aún no tenga.
     */
    const {
      data: clientes,
      error: clientesError,
    } = await supabase
      .from(
        "clientes_inventario"
      )
      .select(
        `
        id,
        id_cliente,
        nombre,
        carpeta_cliente,
        onedrive_folder_id,
        token_inventario,
        activo
        `
      )
      .eq(
        "activo",
        true
      )
      .order(
        "id_cliente",
        {
          ascending: true,
        }
      );

    if (clientesError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se pudieron consultar los clientes en Supabase.",
          detalle:
            clientesError.message,
        },
        { status: 500 }
      );
    }

    const resultados:
      any[] = [];

    /*
     * 6. Sincronizar clientes.
     *
     * REGLAS:
     *
     * - Si ya tiene onedrive_folder_id,
     *   NO tocamos su carpeta.
     *
     * - Si no tiene carpeta:
     *   1) buscamos por #00001...
     *   2) buscamos por nombre exacto
     *   3) si no existe, la creamos
     *
     * - Si no tiene token, generamos uno.
     */
    for (
      const cliente of
      clientes || []
    ) {
      const prefijo =
        String(
          cliente.id_cliente
        ).padStart(
          5,
          "0"
        );

      const nombreEsperado =
        nombreCarpetaEsperado(
          cliente.id_cliente,
          cliente.nombre,
          cliente.carpeta_cliente
        );

      let tokenInventario =
        cliente.token_inventario;

      let tokenGenerado =
        false;

      /*
       * Generar token si falta.
       */
      if (!tokenInventario) {
        tokenInventario =
          randomUUID();

        const {
          error:
            tokenUpdateError,
        } = await supabase
          .from(
            "clientes_inventario"
          )
          .update({
            token_inventario:
              tokenInventario,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cliente.id
          );

        if (tokenUpdateError) {
          resultados.push({
            id_cliente:
              cliente.id_cliente,

            nombre:
              cliente.nombre,

            estado:
              "error",

            etapa:
              "generar_token",

            error:
              tokenUpdateError.message,
          });

          continue;
        }

        tokenGenerado =
          true;
      }

      /*
       * Si ya está vinculado,
       * no recreamos ni cambiamos
       * su carpeta.
       */
      if (
        cliente.onedrive_folder_id
      ) {
        resultados.push({
          id_cliente:
            cliente.id_cliente,

          nombre:
            cliente.nombre,

          carpeta_cliente:
            cliente.carpeta_cliente,

          onedrive_folder_id:
            cliente.onedrive_folder_id,

          token_generado:
            tokenGenerado,

          estado:
            "ya_sincronizado",
        });

        continue;
      }

      /*
       * A. Buscar por número
       * de cliente.
       */
      const coincidenciasPorId =
        carpetas.filter(
          (carpeta) => {
            const nombre =
              String(
                carpeta.name ||
                  ""
              ).trim();

            return (
              nombre === prefijo ||
              nombre.startsWith(
                `${prefijo} `
              )
            );
          }
        );

      /*
       * Si hay más de una carpeta
       * con el mismo prefijo:
       * NO elegimos automáticamente.
       */
      if (
        coincidenciasPorId.length >
        1
      ) {
        resultados.push({
          id_cliente:
            cliente.id_cliente,

          nombre:
            cliente.nombre,

          carpeta_cliente:
            cliente.carpeta_cliente,

          estado:
            "duplicado_onedrive",

          coincidencias:
            coincidenciasPorId.map(
              (item) => ({
                id:
                  item.id,

                nombre:
                  item.name,
              })
            ),
        });

        continue;
      }

      let carpetaEncontrada:
        CarpetaOneDrive | null =
        coincidenciasPorId.length ===
        1
          ? coincidenciasPorId[0]
          : null;

      let metodo:
        | "id_cliente"
        | "nombre_exacto"
        | "creada"
        | null =
        carpetaEncontrada
          ? "id_cliente"
          : null;

      /*
       * B. Respaldo:
       * buscar nombre exacto.
       */
      if (!carpetaEncontrada) {
        const nombresPosibles =
          new Set([
            normalizar(
              nombreEsperado
            ),
            normalizar(
              cliente
                .carpeta_cliente
            ),
          ]);

        const coincidenciasNombre =
          carpetas.filter(
            (carpeta) =>
              nombresPosibles.has(
                normalizar(
                  carpeta.name
                )
              )
          );

        if (
          coincidenciasNombre.length >
          1
        ) {
          resultados.push({
            id_cliente:
              cliente.id_cliente,

            nombre:
              cliente.nombre,

            carpeta_cliente:
              cliente.carpeta_cliente,

            estado:
              "duplicado_onedrive",

            coincidencias:
              coincidenciasNombre.map(
                (item) => ({
                  id:
                    item.id,

                  nombre:
                    item.name,
                })
              ),
          });

          continue;
        }

        if (
          coincidenciasNombre.length ===
          1
        ) {
          carpetaEncontrada =
            coincidenciasNombre[0];

          metodo =
            "nombre_exacto";
        }
      }

      /*
       * C. Si no existe:
       * CREAR carpeta automáticamente.
       */
      if (!carpetaEncontrada) {
        const createFolderUrl =
          `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
            rootFolderId
          )}/children`;

        const createResponse =
          await fetch(
            createFolderUrl,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    nombreEsperado,

                  folder: {},

                  "@microsoft.graph.conflictBehavior":
                    "fail",
                }),

              cache:
                "no-store",
            }
          );

        const createData =
          await leerJsonSeguro(
            createResponse
          );

        if (
          !createResponse.ok ||
          !createData?.id
        ) {
          /*
           * Si Microsoft responde conflicto,
           * volvemos a leer las carpetas por
           * si otro proceso la creó justo antes.
           */
          if (
            createResponse.status ===
            409
          ) {
            const retryResponse =
              await fetch(
                childrenUrl,
                {
                  headers: {
                    Authorization:
                      `Bearer ${accessToken}`,
                  },

                  cache:
                    "no-store",
                }
              );

            const retryData =
              await leerJsonSeguro(
                retryResponse
              );

            const carpetasRetry:
              CarpetaOneDrive[] =
              Array.isArray(
                retryData?.value
              )
                ? retryData.value.filter(
                    (item: any) =>
                      Boolean(
                        item?.folder
                      )
                  )
                : [];

            const retryCoincidencia =
              carpetasRetry.find(
                (carpeta) =>
                  normalizar(
                    carpeta.name
                  ) ===
                  normalizar(
                    nombreEsperado
                  )
              );

            if (
              retryCoincidencia
            ) {
              carpetaEncontrada =
                retryCoincidencia;

              metodo =
                "nombre_exacto";
            }
          }

          if (!carpetaEncontrada) {
            resultados.push({
              id_cliente:
                cliente.id_cliente,

              nombre:
                cliente.nombre,

              carpeta_cliente:
                nombreEsperado,

              estado:
                "error",

              etapa:
                "crear_carpeta",

              error:
                createData
                  ?.error
                  ?.message ||
                createData
                  ?.error
                  ?.code ||
                `HTTP ${createResponse.status}`,
            });

            continue;
          }
        } else {
          carpetaEncontrada = {
            id:
              String(
                createData.id
              ),

            name:
              String(
                createData.name ||
                  nombreEsperado
              ),

            folder:
              createData.folder,
          };

          metodo =
            "creada";

          /*
           * Añadirla al arreglo local
           * para evitar recrearla dentro
           * de esta misma ejecución.
           */
          carpetas.push(
            carpetaEncontrada
          );
        }
      }

      /*
       * D. Guardar vinculación
       * y nombre de carpeta.
       */
      const {
        error: updateError,
      } = await supabase
        .from(
          "clientes_inventario"
        )
        .update({
          carpeta_cliente:
            carpetaEncontrada.name,

          onedrive_folder_id:
            carpetaEncontrada.id,

          token_inventario:
            tokenInventario,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          cliente.id
        );

      if (updateError) {
        resultados.push({
          id_cliente:
            cliente.id_cliente,

          nombre:
            cliente.nombre,

          carpeta_cliente:
            carpetaEncontrada.name,

          onedrive_folder_id:
            carpetaEncontrada.id,

          estado:
            "error",

          etapa:
            "guardar_vinculacion",

          error:
            updateError.message,
        });

        continue;
      }

      resultados.push({
        id_cliente:
          cliente.id_cliente,

        nombre:
          cliente.nombre,

        carpeta_cliente:
          carpetaEncontrada.name,

        onedrive_folder_id:
          carpetaEncontrada.id,

        metodo,

        token_generado:
          tokenGenerado,

        estado:
          metodo === "creada"
            ? "carpeta_creada"
            : "sincronizado",
      });
    }

    /*
     * 7. Resumen.
     */
    const resumen = {
      total_clientes:
        resultados.length,

      carpetas_creadas:
        resultados.filter(
          (item) =>
            item.estado ===
            "carpeta_creada"
        ).length,

      sincronizados:
        resultados.filter(
          (item) =>
            item.estado ===
            "sincronizado"
        ).length,

      ya_sincronizados:
        resultados.filter(
          (item) =>
            item.estado ===
            "ya_sincronizado"
        ).length,

      tokens_generados:
        resultados.filter(
          (item) =>
            item.token_generado ===
            true
        ).length,

      duplicados_onedrive:
        resultados.filter(
          (item) =>
            item.estado ===
            "duplicado_onedrive"
        ).length,

      errores:
        resultados.filter(
          (item) =>
            item.estado ===
            "error"
        ).length,

      carpetas_onedrive:
        carpetas.length,
    };

    return NextResponse.json({
      success: true,

      resumen,

      resultados,

      carpetas_detectadas:
        carpetas.map(
          (carpeta) => ({
            id:
              carpeta.id,

            nombre:
              carpeta.name,
          })
        ),
    });
  } catch (
    error: unknown
  ) {
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