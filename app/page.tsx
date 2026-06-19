"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

export default function Home() {
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

  const handleGenerateExcelFromZip = async () => {
    if (!zipFile) {
      alert("Debes seleccionar el ZIP con PDFs");
      return;
    }

    const pdfjs = await import("pdfjs-dist");

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const zipArrayBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipArrayBuffer);

    const filas: any[] = [];

    for (const fileName of Object.keys(zip.files)) {
      const file = zip.files[fileName];

      if (!fileName.toLowerCase().endsWith(".pdf")) continue;

      const nombrePDF = fileName.split("/").pop() || "";

      const cliente = nombrePDF
        .replace(/\.pdf$/i, "")
        .replace(/\(\d+\)/g, "")
        .replace(/_/g, " ")
        .trim();

      const arrayBuffer = await file.async("arraybuffer");
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let textoPDF = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textoPDF += content.items.map((item: any) => item.str).join(" ") + " ";
      }

      const textoLimpio = textoPDF.toUpperCase();

      let paqueteria = "";

      if (textoLimpio.includes("DHL")) {
        paqueteria = "DHL";
      } else if (textoLimpio.includes("FEDEX")) {
        paqueteria = "FEDEX";
      } else if (textoLimpio.includes("ESTAFETA")) {
        paqueteria = "ESTAFETA";
      }

      let guias: string[] = [];

      if (paqueteria === "DHL") {
        const matchesDHL = textoPDF.matchAll(
          /WAYBILL\s*[:#-]?\s*([\d\s-]{8,30})/gi
        );

        for (const match of matchesDHL) {
          const guia = match[1].replace(/[\s-]/g, "");
          if (guia.length >= 8 && guia.length <= 30) guias.push(guia);
        }
      }

      if (paqueteria === "ESTAFETA") {
        const matchesEstafeta = textoPDF.matchAll(
          /CONFIRMACION\s*[:#-]?\s*([\d\s-]{8,30})/gi
        );

        for (const match of matchesEstafeta) {
          const guia = match[1].replace(/[\s-]/g, "");
          if (guia.length >= 8 && guia.length <= 30) guias.push(guia);
        }
      }

      if (paqueteria === "FEDEX") {
        const posiblesFedex = textoPDF.match(/\b\d{12}\b|\b\d{15}\b/g) || [];
        guias.push(...posiblesFedex);
      }

      guias = guias.filter((guia) => {
        if (!guia) return false;
        if (!/^\d+$/.test(guia)) return false;
        if (guia.startsWith("52")) return false;
        if (guia.length < 8) return false;
        if (guia.length > 30) return false;
        return true;
      });

      const guiasUnicas = Array.from(new Set(guias));

      if (guiasUnicas.length === 0) {
        const numeroPedido = filas.length + 1;

        filas.push({
          pedido: `PED-${String(numeroPedido).padStart(3, "0")}`,
          fecha_carga: new Date().toISOString(),
          cliente,
          telefono_whatsapp: "",
          guia: "GUIA_NO_DETECTADA",
          paqueteria: paqueteria || "NO_DETECTADA",
          nombre_pdf: nombrePDF,
          estado_17track: "Pendiente",
          ultimo_estado_enviado: "",
          enviado: "",
        });
      } else {
        guiasUnicas.forEach((guia) => {
          const numeroPedido = filas.length + 1;

          filas.push({
            pedido: `PED-${String(numeroPedido).padStart(3, "0")}`,
            fecha_carga: new Date().toISOString(),
            cliente,
            telefono_whatsapp: "",
            guia,
            paqueteria: paqueteria || "NO_DETECTADA",
            nombre_pdf: nombrePDF,
            estado_17track: "Pendiente",
            ultimo_estado_enviado: "",
            enviado: "",
          });
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(filas);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Guias");
    XLSX.writeFile(workbook, "plantilla_guias_generada.xlsx");

    alert("Excel generado correctamente");
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

        if (data.success) {
          cliente.enviado = "SI";

          const { error: insertError } = await supabase.from("envios").insert([
            {
              cliente: cliente.cliente,
              telefono_whatsapp: telefonoLimpio,
              pedido: cliente.pedido,
              guia: guiaLimpia,
              paqueteria: cliente.paqueteria,
              pdf: pdfUrl,
              estatus_actual: "Enviado",
              ultimo_whatsapp: "Guía enviada",
              entregado: false,
              fecha_envio: new Date().toISOString(),
            },
          ]);

          if (insertError) {
            nuevosLogs.push(
              `⚠️ WhatsApp enviado a ${cliente.cliente}, pero NO se guardó en Supabase: ${insertError.message}`
            );
          } else {
            nuevosLogs.push(`✅ WhatsApp enviado y guardado: ${cliente.cliente}`);
          }
        } else {
          await supabase.from("envios").insert([
            {
              cliente: cliente.cliente,
              telefono_whatsapp: telefonoLimpio,
              pedido: cliente.pedido,
              guia: guiaLimpia,
              paqueteria: cliente.paqueteria,
              pdf: pdfUrl,
              estatus_actual: "Error WhatsApp",
              ultimo_whatsapp: data.error || "Error al enviar guía",
              entregado: false,
              fecha_envio: new Date().toISOString(),
            },
          ]);

          nuevosLogs.push(`❌ Error con ${cliente.cliente}: ${data.error}`);
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
  <main className="min-h-screen bg-gray-100 p-10 text-gray-900">

    <div className="flex justify-end mb-4">
      <button
        onClick={() => {
          document.cookie = "vipack-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
window.location.href = "/login";
        }}
        className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
      >
        Cerrar sesión
      </button>
    </div>
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-center gap-6 mb-8">
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

          <div className="flex gap-4 flex-wrap">
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
            <div className="flex gap-2 items-center">
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