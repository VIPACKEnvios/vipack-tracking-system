const LIMITE_EXCEL_RECOLECCIONES = 10 * 1024 * 1024;

export async function leerExcelRecoleccionesSeguro(
  response: Response
): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el Excel. HTTP ${response.status}`
    );
  }

  const longitud = response.headers.get("content-length");

  if (longitud !== null) {
    const tamano = Number(longitud);

    if (
      !Number.isSafeInteger(tamano) ||
      tamano < 0 ||
      tamano > LIMITE_EXCEL_RECOLECCIONES
    ) {
      await response.body?.cancel();
      throw new Error(
        "El Excel de recolecciones tiene un tamano no permitido."
      );
    }
  }

  if (!response.body) {
    throw new Error("La descarga del Excel no contiene datos.");
  }

  const lector = response.body.getReader();
  const fragmentos: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await lector.read();

      if (done) break;

      total += value.byteLength;

      if (total > LIMITE_EXCEL_RECOLECCIONES) {
        await lector.cancel();
        throw new Error(
          "El Excel de recolecciones excede el limite de 10 MB."
        );
      }

      fragmentos.push(value);
    }
  } finally {
    lector.releaseLock();
  }

  if (total < 4) {
    throw new Error("El archivo Excel esta vacio o incompleto.");
  }

  const resultado = new Uint8Array(total);
  let posicion = 0;

  for (const fragmento of fragmentos) {
    resultado.set(fragmento, posicion);
    posicion += fragmento.byteLength;
  }

  const firmaZipValida =
    resultado[0] === 0x50 &&
    resultado[1] === 0x4b &&
    resultado[2] === 0x03 &&
    resultado[3] === 0x04;

  if (!firmaZipValida) {
    throw new Error(
      "El archivo descargado no tiene una firma XLSX valida."
    );
  }

  return resultado.buffer;
}