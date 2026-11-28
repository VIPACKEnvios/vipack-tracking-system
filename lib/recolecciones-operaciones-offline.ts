import * as XLSX from "xlsx";

const HOJA = "Operaciones_Offline";

const COLUMNAS = [
  "operationId",
  "recolectorId",
  "folio",
  "estadoAnterior",
  "estado",
  "confirmadoEn",
];

const ESTADOS = new Set([
  "Pendiente",
  "En ruta",
  "Recolectada",
  "No lista",
  "Reprogramada",
  "Cancelada",
]);

const ESTADOS_DESTINO = new Set([
  "En ruta",
  "Recolectada",
  "No lista",
  "Reprogramada",
]);

export type OperacionOffline = {
  operationId: string;
  recolectorId: string;
  folio: string;
  estadoAnterior: string;
  estado: string;
};

type OperacionConfirmada = OperacionOffline & {
  confirmadoEn: string;
};

export type ResultadoOperacionOffline =
  | "NUEVA"
  | "CONFIRMADA"
  | "CONFLICTO";

export function validarOperacionOffline(
  operacion: OperacionOffline
): boolean {

  return (
    typeof operacion.operationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      operacion.operationId
    ) &&
    typeof operacion.recolectorId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      operacion.recolectorId
    ) &&
    typeof operacion.folio === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(operacion.folio) &&
    ESTADOS.has(operacion.estadoAnterior) &&
    ESTADOS_DESTINO.has(operacion.estado) &&
    operacion.estadoAnterior !== operacion.estado
  );
}

function leerOperaciones(
  workbook: XLSX.WorkBook
): OperacionConfirmada[] {

  const hoja = workbook.Sheets[HOJA];

  if (!hoja) {
    return [];
  }

  const encabezados = XLSX.utils.sheet_to_json<unknown[]>(
    hoja,
    {
      header: 1,
      blankrows: false,
      raw: true,
    }
  )[0];

  if (
    !encabezados ||
    encabezados.length !== COLUMNAS.length ||
    COLUMNAS.some(
      (columna, indice) =>
        encabezados[indice] !== columna
    )
  ) {
    throw new Error(
      "Registro offline con estructura invalida."
    );
  }

  const registros =
    XLSX.utils.sheet_to_json<OperacionConfirmada>(
      hoja,
      {
        defval: "",
        raw: true,
      }
    );

  const identificadores = new Set<string>();

  for (const registro of registros) {

    if (
      !validarOperacionOffline(registro) ||
      typeof registro.confirmadoEn !== "string" ||
      !Number.isFinite(Date.parse(registro.confirmadoEn))
    ) {
      throw new Error(
        "Registro offline invalido."
      );
    }

    const id = registro.operationId.toLowerCase();

    if (identificadores.has(id)) {
      throw new Error(
        "Identificador offline duplicado en la matriz."
      );
    }

    identificadores.add(id);
  }

  return registros;
}

export function consultarOperacionOffline(
  workbook: XLSX.WorkBook,
  operacion: OperacionOffline
): ResultadoOperacionOffline {

  if (!validarOperacionOffline(operacion)) {
    throw new Error("Operacion offline invalida.");
  }

  const registros = leerOperaciones(workbook);

  const existente = registros.find(
    (registro) =>
      registro.operationId.toLowerCase() ===
      operacion.operationId.toLowerCase()
  );

  if (!existente) {
    return "NUEVA";
  }

  const coincide =
    existente.recolectorId.toLowerCase() ===
      operacion.recolectorId.toLowerCase() &&
    existente.folio === operacion.folio &&
    existente.estadoAnterior === operacion.estadoAnterior &&
    existente.estado === operacion.estado;

  return coincide
    ? "CONFIRMADA"
    : "CONFLICTO";
}

export function registrarOperacionOffline(
  workbook: XLSX.WorkBook,
  operacion: OperacionOffline
): ResultadoOperacionOffline {

  const resultado = consultarOperacionOffline(
    workbook,
    operacion
  );

  if (resultado !== "NUEVA") {
    return resultado;
  }

  const registro: OperacionConfirmada = {
    ...operacion,
    operationId: operacion.operationId.toLowerCase(),
    recolectorId: operacion.recolectorId.toLowerCase(),
    confirmadoEn: new Date().toISOString(),
  };

  const hoja = workbook.Sheets[HOJA];

  if (hoja) {

    XLSX.utils.sheet_add_json(
      hoja,
      [registro],
      {
        header: [...COLUMNAS],
        skipHeader: true,
        origin: -1,
      }
    );

  } else {

    const nuevaHoja = XLSX.utils.json_to_sheet(
      [registro],
      {
        header: [...COLUMNAS],
      }
    );

    XLSX.utils.book_append_sheet(
      workbook,
      nuevaHoja,
      HOJA
    );
  }

  return "NUEVA";
}