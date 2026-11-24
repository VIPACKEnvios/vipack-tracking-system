export const TRANSICIONES_RECOLECTOR: Record<
  string,
  readonly string[]
> = {
  Pendiente: [
    "En ruta",
    "Recolectada",
    "No lista",
    "Reprogramada",
  ],
  "En ruta": [
    "Recolectada",
    "No lista",
    "Reprogramada",
  ],
  "No lista": [
    "En ruta",
    "Reprogramada",
  ],
  Reprogramada: [
    "En ruta",
    "Recolectada",
  ],
  Recolectada: [],
  Cancelada: [],
};

export function puedeCambiarEstadoRecolector(
  estadoActual: string,
  estadoNuevo: string
): boolean {
  const actual = estadoActual.trim();
  const nuevo = estadoNuevo.trim();

  return (
    TRANSICIONES_RECOLECTOR[actual]?.includes(nuevo) ??
    false
  );
}