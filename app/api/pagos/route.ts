import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type CotizacionExcel = {
  Folio?: string;
  Cliente?: string;
  WhatsApp?: string;
  Telefono?: string;
  Fecha?: string;
  Total?: number | string;
  TotalCotizacion?: number | string;
};

function numero(valor: unknown) {
  if (typeof valor === "number") return valor;

  if (typeof valor === "string") {
    const limpio = valor.replace(/[$,\s]/g, "");
    const n = Number(limpio);

    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

export async function GET() {
  try {
    /*
      IMPORTANTE:
      Por ahora buscamos control_cotizaciones.xlsx en varias ubicaciones
      comunes para no romper lo que ya tienes funcionando.

      Después, si tu módulo de Cotizaciones usa OneDrive o una ruta
      específica, conectaremos esta API exactamente al mismo origen.
    */

    const posiblesRutas = [
      path.join(process.cwd(), "control_cotizaciones.xlsx"),
      path.join(process.cwd(), "data", "control_cotizaciones.xlsx"),
      path.join(process.cwd(), "public", "control_cotizaciones.xlsx"),
      path.join(process.cwd(), "storage", "control_cotizaciones.xlsx"),
    ];

    const rutaExcel = posiblesRutas.find((ruta) => fs.existsSync(ruta));

    if (!rutaExcel) {
      return NextResponse.json(
        {
          pagos: [],
          error:
            "No se encontró control_cotizaciones.xlsx en el servidor.",
        },
        { status: 200 }
      );
    }

    const workbook = XLSX.readFile(rutaExcel);

    /*
      Primero intenta encontrar una hoja que parezca ser
      la hoja principal de cotizaciones.
    */
    const hojaNombre =
      workbook.SheetNames.find((nombre) =>
        nombre.toLowerCase().includes("cotizacion")
      ) || workbook.SheetNames[0];

    const worksheet = workbook.Sheets[hojaNombre];

    if (!worksheet) {
      return NextResponse.json(
        {
          pagos: [],
          error: "El archivo no contiene hojas válidas.",
        },
        { status: 200 }
      );
    }

    const filas = XLSX.utils.sheet_to_json<CotizacionExcel>(worksheet, {
      defval: "",
    });

    /*
      Agrupamos por folio para evitar que una cotización
      con varias cajas aparezca varias veces.
    */
    const mapa = new Map<
      string,
      {
        folio: string;
        cliente: string;
        whatsapp: string;
        fecha: string;
        total: number;
      }
    >();

    for (const fila of filas) {
      const folio = texto(
        fila.Folio ||
          (fila as any).folio ||
          (fila as any)["FOLIO"] ||
          (fila as any)["Folio Cotización"]
      );

      if (!folio) continue;

      const cliente = texto(
        fila.Cliente ||
          (fila as any).cliente ||
          (fila as any)["Nombre Cliente"]
      );

      const whatsapp = texto(
        fila.WhatsApp ||
          fila.Telefono ||
          (fila as any).whatsapp ||
          (fila as any).telefono
      );

      const fecha = texto(
        fila.Fecha ||
          (fila as any).fecha ||
          (fila as any)["Fecha Cotización"]
      );

      const total = numero(
        fila.Total ??
          fila.TotalCotizacion ??
          (fila as any).total ??
          (fila as any)["Total Cotización"]
      );

      const existente = mapa.get(folio);

      if (!existente) {
        mapa.set(folio, {
          folio,
          cliente,
          whatsapp,
          fecha,
          total,
        });
      } else {
        /*
          Si el Excel tiene varias filas para el mismo folio,
          conservamos los datos generales.

          NO sumamos automáticamente el total aquí porque
          todavía necesitamos confirmar cómo quedó estructurada
          tu hoja real de control_cotizaciones.xlsx.
        */
        if (!existente.cliente && cliente) existente.cliente = cliente;
        if (!existente.whatsapp && whatsapp) existente.whatsapp = whatsapp;
        if (!existente.fecha && fecha) existente.fecha = fecha;

        if (existente.total === 0 && total > 0) {
          existente.total = total;
        }
      }
    }

    const pagos = Array.from(mapa.values())
      .map((cotizacion) => {
        const pagado = 0;
        const saldo = Math.max(cotizacion.total - pagado, 0);

        return {
          ...cotizacion,
          pagado,
          saldo,
          estado:
            saldo <= 0
              ? "Pagado"
              : pagado > 0
              ? "Parcial"
              : "Pendiente",
        };
      })
      .sort((a, b) => b.folio.localeCompare(a.folio));

    return NextResponse.json({
      pagos,
      total: pagos.length,
      hoja: hojaNombre,
    });
  } catch (error) {
    console.error("Error cargando pagos:", error);

    return NextResponse.json(
      {
        pagos: [],
        error: "No fue posible leer las cotizaciones.",
      },
      { status: 500 }
    );
  }
}