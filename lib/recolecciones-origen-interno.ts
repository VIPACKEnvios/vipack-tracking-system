/**
 * Registro privado de solicitudes internas del recolector.
 *
 * No utiliza encabezados HTTP ni campos JSON para identificar
 * el origen de la solicitud.
 *
 * Solamente una referencia al objeto Request registrado
 * dentro del servidor puede reconocerse como interna.
 */
const solicitudesRecolector = new WeakSet<Request>();

export function registrarSolicitudInternaRecolector(
  request: Request
): Request {
  solicitudesRecolector.add(request);
  return request;
}

export function esSolicitudInternaRecolector(
  request: Request
): boolean {
  return solicitudesRecolector.has(request);
}