"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type FormularioBazar = {
  nombre_responsable: string;
  telefono: string;
  direccion: string;
  nombre_bazar: string;
  correo: string;
  productos: string;
  facebook: string;
  referencia_1_nombre: string;
  referencia_1_telefono: string;
  referencia_2_nombre: string;
  referencia_2_telefono: string;
};

type RespuestaRegistro = {
  success?: boolean;
  error?: string;
  id?: string;
  folio?: string;
  carpeta?: string;
  ine_frente_archivo?: string;
  comprobante_domicilio_archivo?: string;
};

const formularioInicial: FormularioBazar = {
  nombre_responsable: "",
  telefono: "",
  direccion: "",
  nombre_bazar: "",
  correo: "",
  productos: "",
  facebook: "",
  referencia_1_nombre: "",
  referencia_1_telefono: "",
  referencia_2_nombre: "",
  referencia_2_telefono: "",
};

export default function RegistroBazarPage() {
  const [formulario, setFormulario] =
    useState<FormularioBazar>(formularioInicial);

  const [archivoIne, setArchivoIne] =
    useState<File | null>(null);

  const [archivoComprobante, setArchivoComprobante] =
    useState<File | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [registroExitoso, setRegistroExitoso] =
    useState(false);

  const [claveArchivos, setClaveArchivos] = useState(0);

  function actualizarCampo(
    evento:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
  ) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function limpiarTelefono(valor: string) {
    return valor.replace(/\D/g, "");
  }

  function validarArchivo(archivo: File | null) {
    if (!archivo) return false;

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    const tamanoMaximo = 10 * 1024 * 1024;

    return (
      tiposPermitidos.includes(archivo.type) &&
      archivo.size <= tamanoMaximo
    );
  }

  async function enviarFormulario(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (enviando) return;

    setMensaje("");
    setRegistroExitoso(false);
    setEnviando(true);

    try {
      const telefonoLimpio = limpiarTelefono(
        formulario.telefono
      );

      const referencia1Telefono = limpiarTelefono(
        formulario.referencia_1_telefono
      );

      const referencia2Telefono = limpiarTelefono(
        formulario.referencia_2_telefono
      );

      if (telefonoLimpio.length < 10) {
        throw new Error(
          "Ingresa un número de teléfono válido de 10 dígitos."
        );
      }

      if (referencia1Telefono.length < 10) {
        throw new Error(
          "Ingresa un teléfono válido para la referencia 1."
        );
      }

      if (referencia2Telefono.length < 10) {
        throw new Error(
          "Ingresa un teléfono válido para la referencia 2."
        );
      }

      if (!archivoIne) {
        throw new Error(
          "Debes subir la fotografía del INE por el frente."
        );
      }

      if (!archivoComprobante) {
        throw new Error(
          "Debes subir el comprobante de domicilio."
        );
      }

      if (!validarArchivo(archivoIne)) {
        throw new Error(
          "El INE debe ser JPG, PNG, WEBP o PDF y pesar máximo 10 MB."
        );
      }

      if (!validarArchivo(archivoComprobante)) {
        throw new Error(
          "El comprobante debe ser JPG, PNG, WEBP o PDF y pesar máximo 10 MB."
        );
      }

      const datosArchivos = new FormData();

      datosArchivos.append(
        "nombre_responsable",
        formulario.nombre_responsable.trim()
      );

      datosArchivos.append(
        "telefono",
        telefonoLimpio
      );

      datosArchivos.append(
        "direccion",
        formulario.direccion.trim()
      );

      datosArchivos.append(
        "nombre_bazar",
        formulario.nombre_bazar.trim()
      );

      datosArchivos.append(
        "correo",
        formulario.correo.trim().toLowerCase()
      );

      datosArchivos.append(
        "productos",
        formulario.productos.trim()
      );

      datosArchivos.append(
        "facebook",
        formulario.facebook.trim()
      );

      datosArchivos.append(
        "referencia_1_nombre",
        formulario.referencia_1_nombre.trim()
      );

      datosArchivos.append(
        "referencia_1_telefono",
        referencia1Telefono
      );

      datosArchivos.append(
        "referencia_2_nombre",
        formulario.referencia_2_nombre.trim()
      );

      datosArchivos.append(
        "referencia_2_telefono",
        referencia2Telefono
      );

      datosArchivos.append(
        "ine_frente",
        archivoIne
      );

      datosArchivos.append(
        "comprobante_domicilio",
        archivoComprobante
      );

      const respuestaArchivos = await fetch(
        "/api/registro-bazar/archivos",
        {
          method: "POST",
          body: datosArchivos,
        }
      );

      let resultadoArchivos: RespuestaRegistro;

      try {
        resultadoArchivos =
          await respuestaArchivos.json();
      } catch {
        throw new Error(
          "El servidor no devolvió una respuesta válida."
        );
      }

      if (!respuestaArchivos.ok) {
        throw new Error(
          resultadoArchivos.error ||
            "No fue posible completar el registro."
        );
      }

      if (
        !resultadoArchivos.success ||
        !resultadoArchivos.folio
      ) {
        throw new Error(
          "El registro se procesó, pero no se recibió el folio."
        );
      }

      setFormulario(formularioInicial);
      setArchivoIne(null);
      setArchivoComprobante(null);
      setClaveArchivos((anterior) => anterior + 1);

      setRegistroExitoso(true);

      setMensaje(
        `Registro enviado correctamente. Folio: ${resultadoArchivos.folio}. VIPACK revisará la información proporcionada.`
      );
    } catch (error) {
      console.error(
        "Error en registro de bazar:",
        error
      );

      setRegistroExitoso(false);

      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible enviar el registro."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg">
        <header className="bg-[#072c74] px-6 py-8 text-center text-white">
          <h1 className="text-3xl font-bold">
            Registro Oficial de Bazares
          </h1>

          <p className="mt-2 text-sm text-blue-100">
            Completa la información para formar parte del
            registro de bazares de VIPACK Envíos.
          </p>
        </header>

        <form
          onSubmit={enviarFormulario}
          className="space-y-8 p-6 md:p-10"
        >
          <section>
            <h2 className="mb-5 border-b pb-2 text-xl font-bold text-slate-800">
              Datos del responsable
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <Campo
                etiqueta="Nombre completo"
                nombre="nombre_responsable"
                valor={formulario.nombre_responsable}
                onChange={actualizarCampo}
                requerido
              />

              <Campo
                etiqueta="Número de teléfono"
                nombre="telefono"
                valor={formulario.telefono}
                onChange={actualizarCampo}
                tipo="tel"
                placeholder="Ejemplo: 6641234567"
                requerido
              />

              <Campo
                etiqueta="Correo electrónico"
                nombre="correo"
                valor={formulario.correo}
                onChange={actualizarCampo}
                tipo="email"
              />

              <div className="md:col-span-2">
                <Campo
                  etiqueta="Dirección completa"
                  nombre="direccion"
                  valor={formulario.direccion}
                  onChange={actualizarCampo}
                  placeholder="Calle, número, colonia, ciudad y estado"
                  requerido
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-5 border-b pb-2 text-xl font-bold text-slate-800">
              Información del bazar
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <Campo
                etiqueta="Nombre del negocio o bazar"
                nombre="nombre_bazar"
                valor={formulario.nombre_bazar}
                onChange={actualizarCampo}
                requerido
              />

              <Campo
                etiqueta="Link de Facebook del negocio"
                nombre="facebook"
                valor={formulario.facebook}
                onChange={actualizarCampo}
                tipo="url"
                placeholder="https://www.facebook.com/tu-bazar"
                requerido
              />

              <div className="md:col-span-2">
                <label
                  htmlFor="productos"
                  className="mb-2 block font-semibold text-slate-700"
                >
                  ¿Qué productos vende?
                  <span className="ml-1 text-red-600">
                    *
                  </span>
                </label>

                <textarea
                  id="productos"
                  name="productos"
                  value={formulario.productos}
                  onChange={actualizarCampo}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ejemplo: ropa, bolsas, calzado, cosméticos..."
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 border-b pb-2 text-xl font-bold text-slate-800">
              Referencias
            </h2>

            <p className="mb-5 text-sm text-slate-500">
              Registra dos referencias personales o comerciales.
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <Campo
                etiqueta="Nombre de la referencia 1"
                nombre="referencia_1_nombre"
                valor={formulario.referencia_1_nombre}
                onChange={actualizarCampo}
                requerido
              />

              <Campo
                etiqueta="Teléfono de la referencia 1"
                nombre="referencia_1_telefono"
                valor={formulario.referencia_1_telefono}
                onChange={actualizarCampo}
                tipo="tel"
                placeholder="10 dígitos"
                requerido
              />

              <Campo
                etiqueta="Nombre de la referencia 2"
                nombre="referencia_2_nombre"
                valor={formulario.referencia_2_nombre}
                onChange={actualizarCampo}
                requerido
              />

              <Campo
                etiqueta="Teléfono de la referencia 2"
                nombre="referencia_2_telefono"
                valor={formulario.referencia_2_telefono}
                onChange={actualizarCampo}
                tipo="tel"
                placeholder="10 dígitos"
                requerido
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 border-b pb-2 text-xl font-bold text-slate-800">
              Documentos
            </h2>

            <p className="mb-5 text-sm text-slate-500">
              Los documentos se utilizarán únicamente para
              validar el registro del bazar.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="ine_frente"
                  className="mb-2 block font-semibold text-slate-700"
                >
                  Fotografía del INE por el frente
                  <span className="ml-1 text-red-600">
                    *
                  </span>
                </label>

                <input
                  key={`ine-${claveArchivos}`}
                  id="ine_frente"
                  name="ine_frente"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  required
                  onChange={(evento) =>
                    setArchivoIne(
                      evento.target.files?.[0] || null
                    )
                  }
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-[#072c74] file:px-4 file:py-3 file:font-semibold file:text-white hover:file:bg-blue-900"
                />

                <p className="mt-2 text-sm text-slate-500">
                  Formatos permitidos: JPG, PNG, WEBP o PDF.
                  Máximo 10 MB.
                </p>

                {archivoIne && (
                  <p className="mt-2 text-sm font-medium text-green-700">
                    Archivo seleccionado: {archivoIne.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="comprobante_domicilio"
                  className="mb-2 block font-semibold text-slate-700"
                >
                  Comprobante de domicilio
                  <span className="ml-1 text-red-600">
                    *
                  </span>
                </label>

                <input
                  key={`comprobante-${claveArchivos}`}
                  id="comprobante_domicilio"
                  name="comprobante_domicilio"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  required
                  onChange={(evento) =>
                    setArchivoComprobante(
                      evento.target.files?.[0] || null
                    )
                  }
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:border-0 file:bg-[#072c74] file:px-4 file:py-3 file:font-semibold file:text-white hover:file:bg-blue-900"
                />

                <p className="mt-2 text-sm text-slate-500">
                  Puede ser recibo de luz, agua, teléfono,
                  internet o estado de cuenta.
                </p>

                {archivoComprobante && (
                  <p className="mt-2 text-sm font-medium text-green-700">
                    Archivo seleccionado:{" "}
                    {archivoComprobante.name}
                  </p>
                )}
              </div>
            </div>
          </section>

          <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4"
            />

            <span className="text-sm text-slate-700">
              Confirmo que la información proporcionada es
              correcta y autorizo a VIPACK Envíos a utilizarla
              para fines de registro, control y seguridad.
            </span>
          </label>

          {mensaje && (
            <div
              role="alert"
              className={`rounded-lg px-4 py-3 text-sm font-semibold ${
                registroExitoso
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-[#072c74] px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando
              ? "Guardando registro y documentos..."
              : "Enviar registro"}
          </button>
        </form>
      </div>
    </main>
  );
}

type CampoProps = {
  etiqueta: string;
  nombre: keyof FormularioBazar;
  valor: string;
  tipo?: string;
  placeholder?: string;
  requerido?: boolean;
  onChange: (
    evento: ChangeEvent<HTMLInputElement>
  ) => void;
};

function Campo({
  etiqueta,
  nombre,
  valor,
  tipo = "text",
  placeholder,
  requerido = false,
  onChange,
}: CampoProps) {
  return (
    <div>
      <label
        htmlFor={nombre}
        className="mb-2 block font-semibold text-slate-700"
      >
        {etiqueta}

        {requerido && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </label>

      <input
        id={nombre}
        name={nombre}
        type={tipo}
        value={valor}
        onChange={onChange}
        placeholder={placeholder}
        required={requerido}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}