import { PATCH } from "@/app/api/recolecciones/route";
import { registrarSolicitudInternaRecolector } from "@/lib/recolecciones-origen-interno";
import {
  validarOperacionOffline,
  type OperacionOffline,
} from "@/lib/recolecciones-operaciones-offline";

export async function actualizarEstadoRecolectorEnMatriz(
  folio: string,
  estado: string,
  operacion?: OperacionOffline
) {

  if (
    operacion &&
    (
      !validarOperacionOffline(operacion) ||
      operacion.folio !== folio ||
      operacion.estado !== estado
    )
  ) {
    throw new Error("Operacion interna offline invalida.");
  }

  const solicitud = new Request(
    "http://localhost/api/recolecciones",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        operacion
          ? { folio, estado, operacionOffline: operacion }
          : { folio, estado }
      ),
    }
  );

  registrarSolicitudInternaRecolector(solicitud);

  return PATCH(solicitud);
}