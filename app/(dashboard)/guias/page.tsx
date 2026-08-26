"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

export default function GuiasPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pdfsEncontrados, setPdfsEncontrados] = useState<string[]>([]);
  const [idEnvio, setIdEnvio] = useState("");

  const enviarActualizacionManual = async () => {
    if (!idEnvio) {
      alert("Escribe el ID del envío");
      return;
    }

    const confirmar = confirm("¿Enviar WhatsApp de actualización al cliente?");
    if (!confirmar) return;

    const response = await fetch("/api/enviar-actualizacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(idEnvio) }),
    });

    const data = await response.json();

    if (data.success) {
      alert("✅ WhatsApp enviado correctamente");
      setIdEnvio("");
    } else {
      alert("❌ Error: " + data.error);
    }
  };

  const limpiarSoloDigitos = (valor: unknown) =>
    String(valor || "").replace(/\D/g, "");

  const normalizarNombreCliente = (nombrePDF: string) =>
    nombrePDF
      .replace(/\.pdf$/i, "")
      .replace(/\(\d+\)/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const detectarPaqueteria = (
    textoPDF: string,
    nombrePDF: string
  ) => {
    const fuente = `${textoPDF} ${nombrePDF}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();

    /*
     * ESTAFETA:
     * En las etiquetas reales el logotipo puede no formar parte
     * del texto extraído por PDF.js, pero sí aparecen frases como
     * "Código de Rastreo" y "CONFIRMACION".
     */
    if (
      fuente.includes("ESTAFETA") ||
      fuente.includes("CODIGO DE RASTREO") ||
      fuente.includes("CONFIRMACION")
    ) {
      return "ESTAFETA";
    }

    if (
      fuente.includes("FEDEX") ||
      fuente.includes("FEDERAL EXPRESS")
    ) {
      return "FEDEX";
    }

    if (
      fuente.includes("DHL") ||
      fuente.includes("DHL EXPRESS") ||
      fuente.includes("WAYBILL")
    ) {
      return "DHL";
    }

    return "";
  };

  const normalizarTelefonoMexico = (valor: unknown) => {
    let telefono = limpiarSoloDigitos(valor);

    if (
      telefono.length === 13 &&
      telefono.startsWith("521")
    ) {
      telefono = telefono.slice(3);
    } else if (
      telefono.length === 12 &&
      telefono.startsWith("52")
    ) {
      telefono = telefono.slice(2);
    }

    return telefono.length === 10 ? telefono : "";
  };

  const extraerTelefonoDestinatario = (
    textoPDF: string,
    paqueteria: string,
    paginasTexto: string[] = []
  ) => {
    const texto = String(textoPDF || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    /*
     * DHL:
     * El teléfono correcto del destinatario aparece normalmente
     * en la SEGUNDA HOJA, dentro del bloque:
     *
     * Receiver:
     * ...
     * Contact:
     * +52XXXXXXXXXX
     *
     * Por eso NO usamos el teléfono del Shipper/remitente.
     */
    if (paqueteria === "DHL") {
      const segundaHoja = String(
        paginasTexto[1] || paginasTexto[0] || texto
      )
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      /*
       * Primero aislamos el bloque del destinatario.
       */
      const receiverMatch = segundaHoja.match(
        /RECEIVER\s*:?\s*([\s\S]*?)(?=PRODUCT\s+DETAILS|PAYER\s+DETAILS|SHIPMENT\s+DETAILS|FEATURES\s*\/\s*SERVICES|$)/i
      );

      const bloqueReceiver =
        receiverMatch?.[1] || "";

      /*
       * Buscar primero números con lada de México (+52)
       * dentro del bloque Receiver.
       */
      const telefonosCon52 = Array.from(
        bloqueReceiver.matchAll(
          /\+?\s*52\s*(?:1\s*)?(\d[\d\s().-]{8,18}\d)/g
        )
      );

      for (
        let i = telefonosCon52.length - 1;
        i >= 0;
        i--
      ) {
        const telefono =
          normalizarTelefonoMexico(
            `52${telefonosCon52[i][1]}`
          );

        if (telefono) {
          return telefono;
        }
      }

      /*
       * Si PDF.js separó el +52 del resto del número,
       * buscamos cualquier teléfono mexicano de 10 dígitos
       * dentro del bloque Receiver.
       */
      const candidatosReceiver =
        Array.from(
          bloqueReceiver.matchAll(
            /(?<!\d)(\d[\d\s().-]{8,18}\d)(?!\d)/g
          )
        );

      for (
        let i = candidatosReceiver.length - 1;
        i >= 0;
        i--
      ) {
        const telefono =
          normalizarTelefonoMexico(
            candidatosReceiver[i][1]
          );

        if (telefono) {
          return telefono;
        }
      }

      /*
       * Último respaldo DHL:
       * en la segunda hoja normalmente aparece primero
       * el teléfono del remitente y después el del receptor.
       * Tomamos la última coincidencia +52 válida.
       */
      const todosCon52 = Array.from(
        segundaHoja.matchAll(
          /\+?\s*52\s*(?:1\s*)?(\d[\d\s().-]{8,18}\d)/g
        )
      );

      for (
        let i = todosCon52.length - 1;
        i >= 0;
        i--
      ) {
        const telefono =
          normalizarTelefonoMexico(
            `52${todosCon52[i][1]}`
          );

        if (telefono) {
          return telefono;
        }
      }
    }

    /*
     * ESTAFETA:
     * las etiquetas reales pueden traer primero el teléfono
     * del remitente y después el del destinatario.
     * Tomamos la última coincidencia "CEL".
     */
    const matches = Array.from(
      texto.matchAll(
        /\bCEL(?:ULAR)?\.?\s*[:.-]?\s*(\d[\d\s().-]{8,18}\d)/gi
      )
    );

    for (
      let i = matches.length - 1;
      i >= 0;
      i--
    ) {
      const telefono =
        normalizarTelefonoMexico(
          matches[i][1]
        );

      if (telefono) {
        return telefono;
      }
    }

    /*
     * Respaldo general para TEL / TELÉFONO / PHONE / WHATSAPP.
     */
    const alternos = Array.from(
      texto.matchAll(
        /(?:TEL(?:EFONO)?|TELÉFONO|PHONE|WHATSAPP)\s*[:#.-]?\s*(\+?\s*52\s*)?(?:1\s*)?(\d[\d\s().-]{8,18}\d)/gi
      )
    );

    for (
      let i = alternos.length - 1;
      i >= 0;
      i--
    ) {
      const prefijo =
        alternos[i][1] ? "52" : "";

      const telefono =
        normalizarTelefonoMexico(
          `${prefijo}${alternos[i][2]}`
        );

      if (telefono) {
        return telefono;
      }
    }

    return "";
  };

  const limpiarCandidatoGuia = (valor: string) =>
    valor.replace(/[^\d]/g, "");

  const guiaValida = (
    guia: string,
    paqueteria: string,
    telefono: string
  ) => {
    if (!guia || !/^\d+$/.test(guia)) return false;
    if (telefono && guia === telefono) return false;

    if (
      guia.length === 12 &&
      guia.startsWith("52")
    ) {
      return false;
    }

    if (
      guia.length === 13 &&
      guia.startsWith("521")
    ) {
      return false;
    }

    if (paqueteria === "DHL") {
      return guia.length === 10;
    }

    if (paqueteria === "FEDEX") {
      return (
        guia.length === 12 ||
        guia.length === 15
      );
    }

    /*
     * En las etiquetas reales de Estafeta que revisamos,
     * "Código de Rastreo" usa 10 dígitos.
     */
    if (paqueteria === "ESTAFETA") {
      return guia.length === 10;
    }

    return guia.length >= 8 && guia.length <= 30;
  };

  const extraerGuiasPDF = (
    textoPDF: string,
    paqueteria: string,
    telefono: string
  ) => {
    const texto = String(textoPDF || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ");

    const candidatos: string[] = [];

    const agregarMatches = (
      regex: RegExp,
      indice = 1
    ) => {
      for (const match of texto.matchAll(regex)) {
        const bruto = match[indice];

        if (!bruto) continue;

        const guia =
          limpiarCandidatoGuia(bruto);

        if (
          guiaValida(
            guia,
            paqueteria,
            telefono
          )
        ) {
          candidatos.push(guia);
        }
      }
    };

    /*
     * REGLA PRINCIPAL ESTAFETA REAL:
     *
     * Código de Rastreo: 3455849102
     *
     * Un solo PDF puede tener varias páginas y cada página
     * puede traer una guía distinta. matchAll obtiene TODAS.
     */
    agregarMatches(
      /C[ÓO]DIGO\s+DE\s+RASTREO\s*[:#.-]?\s*([0-9][0-9\s-]{8,20}[0-9])/gi
    );

    if (paqueteria === "DHL") {
      agregarMatches(
        /(?:WAYBILL|AWB|TRACKING\s*(?:NO|NUMBER|#)?|GUIA|GU[IÍ]A)\s*[:#.-]?\s*([\d\s-]{8,24})/gi
      );
    }

    if (paqueteria === "ESTAFETA") {
      agregarMatches(
        /(?:NO\.?\s*DE\s*GUIA|NO\.?\s*DE\s*GU[IÍ]A|GUIA|GU[IÍ]A|RASTREO|TRACKING)\s*[:#.-]?\s*([\d\s-]{8,24})/gi
      );
    }

    if (paqueteria === "FEDEX") {
      agregarMatches(
        /(?:TRACKING\s*(?:ID|NO|NUMBER|#)?|MASTER\s*TRACKING|GUIA|GU[IÍ]A)\s*[:#.-]?\s*([\d\s-]{10,24})/gi
      );
    }

    /*
     * Fallback por longitud, SOLO si las etiquetas no dieron nada.
     */
    if (candidatos.length === 0) {
      if (
        paqueteria === "DHL" ||
        paqueteria === "ESTAFETA"
      ) {
        const encontrados =
          texto.match(
            /(?<!\d)\d{10}(?!\d)/g
          ) || [];

        candidatos.push(
          ...encontrados.filter((guia) =>
            guiaValida(
              guia,
              paqueteria,
              telefono
            )
          )
        );
      }

      if (paqueteria === "FEDEX") {
        const encontrados =
          texto.match(
            /(?<!\d)(?:\d{12}|\d{15})(?!\d)/g
          ) || [];

        candidatos.push(
          ...encontrados.filter((guia) =>
            guiaValida(
              guia,
              paqueteria,
              telefono
            )
          )
        );
      }
    }

    return Array.from(
      new Set(candidatos)
    );
  };

  const handleGenerateExcelFromZip = async () => {
    if (!zipFile) {
      alert("Debes seleccionar el ZIP con PDFs");
      return;
    }

    try {
      setLogs([
        "📦 Leyendo ZIP...",
      ]);

      const pdfjs =
        await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc =
        new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

      const zipArrayBuffer =
        await zipFile.arrayBuffer();

      const zip =
        await JSZip.loadAsync(
          zipArrayBuffer
        );

      const filas: any[] = [];
      const logsGeneracion: string[] = [];

      let totalPDF = 0;
      let totalGuias = 0;
      let pdfSinGuia = 0;
      let pdfSinPaqueteria = 0;

      for (
        const fileName of Object.keys(
          zip.files
        )
      ) {
        const file =
          zip.files[fileName];

        if (
          file.dir ||
          !fileName
            .toLowerCase()
            .endsWith(".pdf")
        ) {
          continue;
        }

        totalPDF++;

        const nombrePDF =
          fileName
            .split("/")
            .pop() || "";

        const cliente =
          normalizarNombreCliente(
            nombrePDF
          );

        try {
          const arrayBuffer =
            await file.async(
              "arraybuffer"
            );

          const pdf =
            await pdfjs
              .getDocument({
                data: arrayBuffer,
              })
              .promise;

          let textoPDF = "";
          const paginasTexto: string[] = [];

          for (
            let i = 1;
            i <= pdf.numPages;
            i++
          ) {
            const page =
              await pdf.getPage(i);

            const content =
              await page.getTextContent();

            const textoPagina =
              content.items
                .map(
                  (item: any) =>
                    item?.str || ""
                )
                .join(" ")
                .replace(/\u00a0/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            paginasTexto.push(
              textoPagina
            );

            textoPDF +=
              textoPagina + " ";
          }

          textoPDF = textoPDF
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const paqueteria =
            detectarPaqueteria(
              textoPDF,
              nombrePDF
            );

          if (!paqueteria) {
            pdfSinPaqueteria++;
          }

          const telefono =
            extraerTelefonoDestinatario(
              textoPDF,
              paqueteria,
              paginasTexto
            );

          const guias =
            extraerGuiasPDF(
              textoPDF,
              paqueteria,
              telefono
            );

          if (guias.length === 0) {
            pdfSinGuia++;

            const numeroPedido =
              filas.length + 1;

            filas.push({
              pedido: `PED-${String(
                numeroPedido
              ).padStart(3, "0")}`,
              fecha_carga:
                new Date().toISOString(),
              cliente,
              telefono_whatsapp:
                telefono,
              guia:
                "GUIA_NO_DETECTADA",
              paqueteria:
                paqueteria ||
                "NO_DETECTADA",
              nombre_pdf: nombrePDF,
              estado_17track:
                "Pendiente",
              ultimo_estado_enviado:
                "",
              enviado: "",
            });

            logsGeneracion.push(
              `⚠️ ${nombrePDF}: no se detectó guía${
                paqueteria
                  ? ""
                  : " ni paquetería"
              }.`
            );

            continue;
          }

          for (
            const guia of guias
          ) {
            const numeroPedido =
              filas.length + 1;

            filas.push({
              pedido: `PED-${String(
                numeroPedido
              ).padStart(3, "0")}`,
              fecha_carga:
                new Date().toISOString(),
              cliente,
              telefono_whatsapp:
                telefono,
              guia,
              paqueteria:
                paqueteria ||
                "NO_DETECTADA",
              nombre_pdf: nombrePDF,
              estado_17track:
                "Pendiente",
              ultimo_estado_enviado:
                "",
              enviado: "",
            });

            totalGuias++;
          }

          logsGeneracion.push(
            `✅ ${nombrePDF}: ${
              paqueteria ||
              "paquetería no detectada"
            } | ${guias.length} guía(s) detectada(s)${
              telefono
                ? " | teléfono detectado"
                : ""
            }`
          );
        } catch (pdfError: any) {
          pdfSinGuia++;

          const numeroPedido =
            filas.length + 1;

          filas.push({
            pedido: `PED-${String(
              numeroPedido
            ).padStart(3, "0")}`,
            fecha_carga:
              new Date().toISOString(),
            cliente,
            telefono_whatsapp: "",
            guia:
              "GUIA_NO_DETECTADA",
            paqueteria:
              "NO_DETECTADA",
            nombre_pdf: nombrePDF,
            estado_17track:
              "Pendiente",
            ultimo_estado_enviado:
              "",
            enviado: "",
          });

          logsGeneracion.push(
            `❌ ${nombrePDF}: no se pudo leer el PDF. ${
              pdfError?.message ||
              "Error desconocido"
            }`
          );
        }
      }

      if (filas.length === 0) {
        alert(
          "No se encontraron PDFs dentro del ZIP."
        );
        setLogs([
          "❌ No se encontraron archivos PDF dentro del ZIP.",
        ]);
        return;
      }

      const encabezados = [
        "pedido",
        "fecha_carga",
        "cliente",
        "telefono_whatsapp",
        "guia",
        "paqueteria",
        "nombre_pdf",
        "estado_17track",
        "ultimo_estado_enviado",
        "enviado",
      ];

      const worksheet =
        XLSX.utils.json_to_sheet(
          filas,
          {
            header: encabezados,
          }
        );

      /*
       * Anchos para que Excel no abra
       * columnas cortadas.
       */
      worksheet["!cols"] = [
        { wch: 14 }, // pedido
        { wch: 26 }, // fecha
        { wch: 35 }, // cliente
        { wch: 20 }, // teléfono
        { wch: 24 }, // guía
        { wch: 16 }, // paquetería
        { wch: 45 }, // PDF
        { wch: 18 }, // estado
        { wch: 25 }, // último estado
        { wch: 12 }, // enviado
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Guias"
      );

      XLSX.writeFile(
        workbook,
        "plantilla_guias_generada.xlsx"
      );

      setLogs([
        `✅ Excel generado: ${filas.length} fila(s).`,
        `📄 PDFs procesados: ${totalPDF}.`,
        `📦 Guías detectadas: ${totalGuias}.`,
        `⚠️ PDFs sin guía: ${pdfSinGuia}.`,
        `⚠️ PDFs sin paquetería: ${pdfSinPaqueteria}.`,
        ...logsGeneracion,
      ]);

      alert(
        `Excel generado correctamente.\n\nPDFs: ${totalPDF}\nGuías detectadas: ${totalGuias}\nSin guía: ${pdfSinGuia}`
      );
    } catch (error: any) {
      console.error(
        "Error generando Excel:",
        error
      );

      setLogs([
        `❌ Error generando Excel: ${
          error?.message ||
          "Error desconocido"
        }`,
      ]);

      alert(
        "No se pudo generar el Excel. Revisa los logs."
      );
    }
  };

  const handleValidate = async () => {
    if (!excelFile || !zipFile) {
      alert("Debes seleccionar Excel y ZIP");
      return;
    }

    const data = await excelFile.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const zipArrayBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipArrayBuffer);

    const nombresPDF: string[] = [];

    for (const fileName of Object.keys(zip.files)) {
      const file = zip.files[fileName];

      if (!fileName.toLowerCase().endsWith(".pdf")) continue;

      const originalName = fileName.split("/").pop() || "";

      const cleanName = originalName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.\-_]/g, "_");

      const pdfBlob = await file.async("blob");

      const { error } = await supabase.storage
        .from("guias")
        .upload(cleanName, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (error) {
        alert("Error subiendo PDF: " + error.message);
        console.error(error);
      } else {
        nombresPDF.push(originalName);
      }
    }

    const normalizarTexto = (texto: string) =>
      String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const clientesConPDF = (jsonData as any[]).map((cliente) => {
      const nombreCliente = normalizarTexto(cliente.cliente);

      const pdfEncontrado = nombresPDF.find((pdf) => {
        const nombrePDF = normalizarTexto(pdf.replace(".pdf", ""));
        return (
          nombrePDF.includes(nombreCliente) ||
          nombreCliente.includes(nombrePDF)
        );
      });

      return {
        ...cliente,
        nombre_pdf: pdfEncontrado || "",
      };
    });

    setClientes(clientesConPDF);
    setPdfsEncontrados(nombresPDF);
    setLogs([]);

    alert("Excel y ZIP validados correctamente");
  };

  const handleSendWhatsApp = async () => {
    if (clientes.length === 0) {
      alert("No hay clientes cargados");
      return;
    }

    const nuevosLogs: string[] = [];

    for (const cliente of clientes) {
      if (cliente.enviado && String(cliente.enviado).toUpperCase() === "SI") {
        nuevosLogs.push(`⏭️ ${cliente.cliente} ya estaba enviado`);
        continue;
      }

      const guiaLimpia = String(cliente.guia || "").trim();

      if (!guiaLimpia || guiaLimpia === "GUIA_NO_DETECTADA") {
        nuevosLogs.push(`❌ No se envió a ${cliente.cliente}: falta guía`);
        continue;
      }

      const { data: existente } = await supabase
        .from("envios")
        .select("id")
        .eq("guia", guiaLimpia)
        .limit(1);

      if (existente && existente.length > 0) {
        nuevosLogs.push(`⏭️ ${cliente.cliente} ya existe en sistema`);
        continue;
      }

      const tienePDF = pdfsEncontrados.includes(cliente.nombre_pdf);

      if (!tienePDF) {
        nuevosLogs.push(`❌ No se envió a ${cliente.cliente}: falta PDF`);
        continue;
      }

      const safePdfName = cliente.nombre_pdf
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/guias/${safePdfName}`;

      const telefonoLimpio = String(cliente.telefono_whatsapp || "")
        .replace(/\D/g, "")
        .trim();

      if (!telefonoLimpio) {
        nuevosLogs.push(`❌ No se envió a ${cliente.cliente}: falta teléfono`);
        continue;
      }

      try {
        /*
         * IMPORTANTE PARA EL HISTORIAL:
         * Primero guardamos el envío en Supabase.
         * Después intentamos enviar WhatsApp.
         *
         * Así nunca tendremos un WhatsApp enviado
         * sin que exista su registro histórico.
         */
        const fechaOriginal = new Date().toISOString();

        const { data: envioCreado, error: insertError } = await supabase
          .from("envios")
          .insert([
            {
              cliente: cliente.cliente,
              telefono_whatsapp: telefonoLimpio,
              pedido: cliente.pedido,
              guia: guiaLimpia,
              paqueteria: cliente.paqueteria,
              pdf: pdfUrl,
              estatus_actual: "Pendiente de WhatsApp",
              ultimo_whatsapp: "",
              ultimo_estado_enviado: "",
              entregado: false,
              fecha_envio: fechaOriginal,
              fecha_ultima_revision: fechaOriginal,
            },
          ])
          .select("id")
          .single();

        if (insertError || !envioCreado) {
          nuevosLogs.push(
            `❌ NO se envió a ${cliente.cliente}: primero debe guardarse el historial en Supabase. ${
              insertError?.message || "No se obtuvo el ID del envío"
            }`
          );
          continue;
        }

        /*
         * REGISTRAR AUTOMÁTICAMENTE EN TRACKINGMORE
         *
         * Por ahora solo usamos TrackingMore para:
         * - ESTAFETA
         * - DHL
         *
         * Si TrackingMore falla, NO borramos el envío
         * ni detenemos el envío de WhatsApp.
         */
        const paqueteriaTracking = String(
          cliente.paqueteria || ""
        ).toUpperCase();

        const usarTrackingMore =
          paqueteriaTracking.includes("ESTAFETA") ||
          paqueteriaTracking.includes("DHL");

        if (usarTrackingMore) {
          try {
            const trackingResponse = await fetch(
              "/api/trackingmore/register",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  guia: guiaLimpia,
                  paqueteria: cliente.paqueteria,
                }),
              }
            );

            const trackingData =
              await trackingResponse.json();

            if (trackingData.success) {
              nuevosLogs.push(
                `📍 TrackingMore registrado: ${cliente.cliente} - ${guiaLimpia}`
              );
            } else {
              nuevosLogs.push(
                `⚠️ El envío quedó guardado, pero TrackingMore no pudo registrarlo: ${
                  trackingData.error ||
                  trackingData.meta?.message ||
                  "Error desconocido"
                }`
              );
            }
          } catch (trackingError: any) {
            nuevosLogs.push(
              `⚠️ El envío quedó guardado, pero falló la conexión con TrackingMore: ${
                trackingError?.message ||
                "Error desconocido"
              }`
            );
          }
        }

        const response = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: telefonoLimpio,
            cliente: cliente.cliente,
            pedido: cliente.pedido,
            guia: guiaLimpia,
            paqueteria: cliente.paqueteria,
            pdfUrl: pdfUrl,
          }),
        });

        const data = await response.json();
        const fechaRevision = new Date().toISOString();

        if (data.success) {
          cliente.enviado = "SI";

          const { error: updateError } = await supabase
            .from("envios")
            .update({
              estatus_actual: "Enviado",
              ultimo_whatsapp: "Guía enviada",
              fecha_ultima_revision: fechaRevision,
            })
            .eq("id", envioCreado.id);

          if (updateError) {
            nuevosLogs.push(
              `⚠️ WhatsApp enviado a ${cliente.cliente}. El historial existe, pero falló la actualización del estado: ${updateError.message}`
            );
          } else {
            nuevosLogs.push(
              `✅ WhatsApp enviado y guardado: ${cliente.cliente} (ID ${envioCreado.id})`
            );
          }
        } else {
          await supabase
            .from("envios")
            .update({
              estatus_actual: "Error WhatsApp",
              ultimo_whatsapp: data.error || "Error al enviar guía",
              fecha_ultima_revision: fechaRevision,
            })
            .eq("id", envioCreado.id);

          nuevosLogs.push(
            `❌ Error con ${cliente.cliente}: ${data.error || "Error al enviar WhatsApp"}. El registro se conservó en el historial.`
          );
        }
      } catch (error: any) {
        nuevosLogs.push(
          `❌ Error inesperado con ${cliente.cliente}: ${error.message}`
        );
      }
    }

    setLogs(nuevosLogs);
  };


  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-100 p-4 text-gray-900 md:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-lg md:p-8">
        <div className="mb-8 flex items-center justify-center gap-6">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              marginBottom: "30px",
            }}
          >
            <img
              src="/vipack-logo.jpg"
              alt="VIPACK"
              style={{
                width: "120px",
                height: "120px",
                objectFit: "contain",
                borderRadius: "12px",
              }}
            />

            <div>
              <h1
                style={{
                  fontSize: "38px",
                  fontWeight: "bold",
                  color: "#072c74",
                  margin: 0,
                }}
              >
                VIPACK
              </h1>

              <p
                style={{
                  fontSize: "18px",
                  color: "#666",
                  marginTop: "5px",
                }}
              >
                Sistema de Rastreo y Notificaciones WhatsApp
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
           <label className="block text-lg font-semibold mb-2 text-gray-900">
              Subir Excel de clientes
            </label>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) setExcelFile(e.target.files[0]);
              }}
              className="w-full border p-3 rounded-lg bg-white text-gray-900"
            />
          </div>

          <div>
            <label className="block text-lg font-semibold mb-2 text-gray-900">
              Subir ZIP con PDFs
            </label>

            <input
              type="file"
              accept=".zip"
              onChange={(e) => {
                if (e.target.files?.[0]) setZipFile(e.target.files[0]);
              }}
             className="w-full border p-3 rounded-lg bg-white text-gray-900"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleValidate}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl"
            >
              Validar archivos
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="bg-green-600 text-white px-6 py-3 rounded-xl"
            >
              Enviar guías WhatsApp
            </button>

            <button
              onClick={handleGenerateExcelFromZip}
              style={{
                background: "purple",
                color: "white",
                padding: "12px 24px",
                borderRadius: "12px",
                border: "none",
              }}
            >
              Generar Excel desde ZIP
            </button>
<button
  onClick={() => window.location.href = "/envios"}
  style={{
    background: "#072c74",
    color: "white",
    padding: "12px 24px",
    borderRadius: "12px",
    border: "none",
    fontWeight: "bold",
  }}
>
  Ver tabla de envíos
</button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="ID del envío"
                value={idEnvio}
                onChange={(e) => setIdEnvio(e.target.value)}
                className="border p-3 rounded-xl bg-white text-gray-900"
              />

              <button
                onClick={enviarActualizacionManual}
                style={{
                  background: "#047857",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "none",
                  fontWeight: "bold",
                  minWidth: "220px",
                  height: "74px",
                }}
              >
                Enviar actualización WhatsApp
              </button>
            </div>
          </div>

          {clientes.length > 0 && (
            <div className="mt-10 overflow-auto">
              <table className="w-full border border-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    {Object.keys(clientes[0]).map((key) => (
                      <th key={key} className="border p-2 text-left">
                        {key}
                      </th>
                    ))}
                    <th className="border p-2 text-left">Estado PDF</th>
                  </tr>
                </thead>

                <tbody>
                  {clientes.map((cliente, index) => (
                    <tr key={index}>
                      {Object.values(cliente).map((value: any, i) => (
                        <td key={i} className="border p-2">
                          {String(value)}
                        </td>
                      ))}

                      <td className="border p-2">
                        {pdfsEncontrados.includes(cliente.nombre_pdf)
                          ? "✅ PDF encontrado"
                          : "❌ PDF no encontrado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-10 bg-black text-green-400 p-4 rounded-xl">
              <h2 className="text-xl mb-4 font-bold">Logs de WhatsApp</h2>

              <div className="space-y-2">
                {logs.map((log, index) => (
                  <p key={index}>{log}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}