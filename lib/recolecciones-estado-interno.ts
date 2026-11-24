import { PATCH } from "@/app/api/recolecciones/route";
import { registrarSolicitudInternaRecolector } from "@/lib/recolecciones-origen-interno";

export async function actualizarEstadoRecolectorEnMatriz(
  folio: string,
  estado: string
) {
  const solicitud = new Request(
    "http://localhost/api/recolecciones",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folio, estado }),
    }
  );

  registrarSolicitudInternaRecolector(solicitud);

  return PATCH(solicitud);
}