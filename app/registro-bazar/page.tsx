"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
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

const pasosCarga = [
  "Validando información",
  "Subiendo documentos",
  "Creando expediente",
  "Generando folio",
  "Finalizando registro",
];

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

  const [folioGenerado, setFolioGenerado] =
    useState("");

  const [claveArchivos, setClaveArchivos] =
    useState(0);

  const [pasoCarga, setPasoCarga] = useState(0);

  useEffect(() => {
    if (!enviando) {
      setPasoCarga(0);
      return;
    }

    const intervalos = [900, 1800, 2900, 4000];

    const temporizadores = intervalos.map(
      (tiempo, indice) =>
        window.setTimeout(() => {
          setPasoCarga(indice + 1);
        }, tiempo)
    );

    return () => {
      temporizadores.forEach((temporizador) =>
        window.clearTimeout(temporizador)
      );
    };
  }, [enviando]);

  const avanceFormulario = useMemo(() => {
    const camposObligatorios = [
      formulario.nombre_responsable,
      formulario.telefono,
      formulario.direccion,
      formulario.nombre_bazar,
      formulario.productos,
      formulario.facebook,
      formulario.referencia_1_nombre,
      formulario.referencia_1_telefono,
      formulario.referencia_2_nombre,
      formulario.referencia_2_telefono,
    ];

    const completados =
      camposObligatorios.filter(
        (valor) => valor.trim().length > 0
      ).length +
      (archivoIne ? 1 : 0) +
      (archivoComprobante ? 1 : 0);

    return Math.round((completados / 12) * 100);
  }, [formulario, archivoIne, archivoComprobante]);

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

  function formatearTamano(bytes: number) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function enviarFormulario(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (enviando) return;

    setMensaje("");
    setRegistroExitoso(false);
    setFolioGenerado("");
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

      if (telefonoLimpio.length !== 10) {
        throw new Error(
          "Ingresa un número de teléfono válido de 10 dígitos."
        );
      }

      if (referencia1Telefono.length !== 10) {
        throw new Error(
          "Ingresa un teléfono válido de 10 dígitos para la referencia 1."
        );
      }

      if (referencia2Telefono.length !== 10) {
        throw new Error(
          "Ingresa un teléfono válido de 10 dígitos para la referencia 2."
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

      setPasoCarga(pasosCarga.length - 1);
      setFormulario(formularioInicial);
      setArchivoIne(null);
      setArchivoComprobante(null);
      setClaveArchivos((anterior) => anterior + 1);
      setFolioGenerado(resultadoArchivos.folio);
      setRegistroExitoso(true);

      setMensaje(
        "Tu expediente fue recibido correctamente y será revisado por el equipo de VIPACK."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
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

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    } finally {
      setEnviando(false);
    }
  }

  function registrarOtroBazar() {
    setRegistroExitoso(false);
    setFolioGenerado("");
    setMensaje("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f7fc] text-slate-900">
      <DecoracionFondo />

      {enviando && (
        <PantallaCarga pasoActual={pasoCarga} />
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#031b46] via-[#073b86] to-[#05a9b8] text-white shadow-[0_24px_70px_rgba(3,27,70,0.25)]">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-10 md:py-10">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur">
                <IconoPaquete className="h-9 w-9" />
              </div>

              <div>
                <span className="inline-flex rounded-full border border-cyan-200/40 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                  Registro oficial VIPACK
                </span>

                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                  Registra tu bazar
                  <span className="block text-cyan-200">
                    de forma segura
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Forma parte de la red de bazares registrados de
                  VIPACK Envíos. Completa tu expediente y nuestro
                  equipo validará la información.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
              <BeneficioRapido
                icono={<IconoReloj />}
                titulo="2–4 minutos"
                texto="Tiempo estimado"
              />

              <BeneficioRapido
                icono={<IconoEscudo />}
                titulo="Datos protegidos"
                texto="Uso interno y seguro"
              />

              <BeneficioRapido
                icono={<IconoDocumento />}
                titulo="Ten a la mano"
                texto="INE y comprobante"
              />
            </div>
          </div>
        </header>

        {registroExitoso ? (
          <PantallaExito
            folio={folioGenerado}
            mensaje={mensaje}
            registrarOtro={registrarOtroBazar}
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-4 lg:sticky lg:top-6">
              <section className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                      Tu avance
                    </p>

                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {avanceFormulario}%
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <IconoLista />
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500 transition-all duration-500"
                    style={{
                      width: `${avanceFormulario}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Tu progreso se guarda mientras mantengas esta
                  página abierta.
                </p>
              </section>

              <section className="rounded-3xl bg-[#061b43] p-5 text-white shadow-[0_18px_45px_rgba(6,27,67,0.18)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                  Antes de comenzar
                </p>

                <div className="mt-4 space-y-4">
                  <PasoLateral
                    numero="01"
                    titulo="Datos del bazar"
                    texto="Responsable, contacto y productos."
                  />

                  <PasoLateral
                    numero="02"
                    titulo="Referencias"
                    texto="Dos contactos personales o comerciales."
                  />

                  <PasoLateral
                    numero="03"
                    titulo="Documentos"
                    texto="INE frontal y comprobante de domicilio."
                  />

                  <PasoLateral
                    numero="04"
                    titulo="Revisión VIPACK"
                    texto="Validaremos tu expediente antes de aprobarlo."
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <IconoCandado />
                  </div>

                  <div>
                    <p className="font-black text-emerald-950">
                      Información confidencial
                    </p>

                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      Tus documentos se utilizan únicamente para
                      validar y proteger el registro del bazar.
                    </p>
                  </div>
                </div>
              </section>
            </aside>

            <form
              onSubmit={enviarFormulario}
              className="overflow-hidden rounded-[30px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]"
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50 px-5 py-5 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                      Expediente de registro
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950">
                      Completa tu información
                    </h2>
                  </div>

                  <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white">
                    Campos con * obligatorios
                  </span>
                </div>
              </div>

              <div className="space-y-8 p-5 sm:p-8">
                <SeccionFormulario
                  numero="01"
                  titulo="Datos del responsable"
                  subtitulo="Persona encargada y contacto principal del bazar."
                  icono={<IconoUsuario />}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Campo
                      etiqueta="Nombre completo"
                      nombre="nombre_responsable"
                      valor={formulario.nombre_responsable}
                      onChange={actualizarCampo}
                      placeholder="Nombre y apellidos"
                      requerido
                    />

                    <Campo
                      etiqueta="Número de teléfono"
                      nombre="telefono"
                      valor={formulario.telefono}
                      onChange={actualizarCampo}
                      tipo="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Ejemplo: 6641234567"
                      requerido
                    />

                    <Campo
                      etiqueta="Correo electrónico"
                      nombre="correo"
                      valor={formulario.correo}
                      onChange={actualizarCampo}
                      tipo="email"
                      placeholder="correo@ejemplo.com"
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
                </SeccionFormulario>

                <SeccionFormulario
                  numero="02"
                  titulo="Información del bazar"
                  subtitulo="Cuéntanos cómo se llama tu negocio y qué productos vendes."
                  icono={<IconoTienda />}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Campo
                      etiqueta="Nombre del negocio o bazar"
                      nombre="nombre_bazar"
                      valor={formulario.nombre_bazar}
                      onChange={actualizarCampo}
                      placeholder="Ejemplo: Bazar express"  
                      requerido
                    />

                    <Campo
                      etiqueta="Link de Facebook del negocio"
                      nombre="facebook"
                      valor={formulario.facebook}
                      onChange={actualizarCampo}
                      tipo="url"
                      placeholder="https://facebook.com/tu-bazar"
                      requerido
                    />

                    <div className="md:col-span-2">
                      <label
                        htmlFor="productos"
                        className="mb-2 block text-sm font-black text-slate-800"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        placeholder="Ejemplo: ropa, bolsas, calzado, cosméticos..."
                      />
                    </div>
                  </div>
                </SeccionFormulario>

                <SeccionFormulario
                  numero="03"
                  titulo="Referencias"
                  subtitulo="Registra dos referencias personales o comerciales."
                  icono={<IconoContactos />}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Campo
                      etiqueta="Nombre de la referencia 1"
                      nombre="referencia_1_nombre"
                      valor={formulario.referencia_1_nombre}
                      onChange={actualizarCampo}
                      placeholder="Nombre completo"
                      requerido
                    />

                    <Campo
                      etiqueta="Teléfono de la referencia 1"
                      nombre="referencia_1_telefono"
                      valor={formulario.referencia_1_telefono}
                      onChange={actualizarCampo}
                      tipo="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10 dígitos"
                      requerido
                    />

                    <Campo
                      etiqueta="Nombre de la referencia 2"
                      nombre="referencia_2_nombre"
                      valor={formulario.referencia_2_nombre}
                      onChange={actualizarCampo}
                      placeholder="Nombre completo"
                      requerido
                    />

                    <Campo
                      etiqueta="Teléfono de la referencia 2"
                      nombre="referencia_2_telefono"
                      valor={formulario.referencia_2_telefono}
                      onChange={actualizarCampo}
                      tipo="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10 dígitos"
                      requerido
                    />
                  </div>
                </SeccionFormulario>

                <SeccionFormulario
                  numero="04"
                  titulo="Documentos"
                  subtitulo="Sube fotografías claras y legibles para validar tu expediente."
                  icono={<IconoDocumento />}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <CargaArchivo
                      key={`ine-${claveArchivos}`}
                      id="ine_frente"
                      etiqueta="INE por el frente"
                      ayuda="Fotografía frontal, sin reflejos ni cortes."
                      archivo={archivoIne}
                      onChange={(archivo) =>
                        setArchivoIne(archivo)
                      }
                      formatearTamano={formatearTamano}
                    />

                    <CargaArchivo
                      key={`comprobante-${claveArchivos}`}
                      id="comprobante_domicilio"
                      etiqueta="Comprobante de domicilio"
                      ayuda="Luz, agua, teléfono, internet o estado de cuenta."
                      archivo={archivoComprobante}
                      onChange={(archivo) =>
                        setArchivoComprobante(archivo)
                      }
                      formatearTamano={formatearTamano}
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <div className="flex items-start gap-3">
                      <IconoInfo className="mt-0.5 h-5 w-5 shrink-0" />

                      <p>
                        Formatos permitidos: JPG, PNG, WEBP o PDF.
                        Cada archivo puede pesar hasta 10 MB.
                      </p>
                    </div>
                  </div>
                </SeccionFormulario>

                <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-300 hover:bg-blue-50">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-5 w-5 shrink-0 accent-[#072c74]"
                  />

                  <span className="text-sm leading-6 text-slate-700">
                    Confirmo que la información proporcionada es
                    correcta y autorizo a VIPACK Envíos a utilizarla
                    para fines de registro, control y seguridad.
                  </span>
                </label>

                {mensaje && !registroExitoso && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
                  >
                    <div className="flex items-start gap-3">
                      <IconoAlerta className="h-5 w-5 shrink-0" />
                      <p>{mensaje}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <IconoReloj className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                    <div>
                      <p className="font-black text-amber-950">
                        Antes de enviar
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        La carga puede tardar entre 20 y 40 segundos.
                        Presiona el botón una sola vez y no cierres
                        esta página.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 text-lg font-black text-white shadow-[0_16px_35px_rgba(5,150,105,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(5,150,105,0.34)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {enviando ? (
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <IconoEnviar className="h-6 w-6 transition group-hover:translate-x-1" />
                  )}

                  {enviando
                    ? "Enviando registro..."
                    : "Registrar mi bazar"}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <IconoEscudo className="h-4 w-4 text-emerald-600" />
                    Información protegida
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <IconoCheck className="h-4 w-4 text-blue-600" />
                    Folio automático
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <IconoReloj className="h-4 w-4 text-amber-600" />
                    Revisión administrativa
                  </span>
                </div>
              </div>
            </form>
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-slate-500">
          <p className="font-bold text-slate-700">
            VIPACK Envíos
          </p>
          <p className="mt-1">
            Registro seguro de bazares · Tijuana, Baja California
          </p>
        </footer>
      </div>
    </main>
  );
}

function PantallaCarga({
  pasoActual,
}: {
  pasoActual: number;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#020b1f]/85 px-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Enviando registro"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="bg-gradient-to-r from-[#031b46] via-[#07519b] to-[#06a9b7] px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <IconoPaquete className="h-8 w-8" />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                VIPACK Envíos
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Registrando tu bazar
              </h2>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <span className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          </div>

          <p className="mt-5 text-center text-sm leading-6 text-slate-600">
            Estamos creando tu expediente y protegiendo tus
            documentos. No cierres esta ventana.
          </p>

          <div className="mt-7 space-y-3">
            {pasosCarga.map((paso, indice) => {
              const completado = indice < pasoActual;
              const activo = indice === pasoActual;

              return (
                <div
                  key={paso}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                    completado
                      ? "border-emerald-200 bg-emerald-50"
                      : activo
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      completado
                        ? "bg-emerald-600 text-white"
                        : activo
                        ? "bg-blue-700 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {completado ? (
                      <IconoCheck className="h-4 w-4" />
                    ) : activo ? (
                      <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                    ) : (
                      indice + 1
                    )}
                  </span>

                  <p
                    className={`text-sm font-bold ${
                      completado
                        ? "text-emerald-900"
                        : activo
                        ? "text-blue-900"
                        : "text-slate-500"
                    }`}
                  >
                    {paso}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
            No presiones atrás ni actualices la página.
          </div>
        </div>
      </div>
    </div>
  );
}

function PantallaExito({
  folio,
  mensaje,
  registrarOtro,
}: {
  folio: string;
  mensaje: string;
  registrarOtro: () => void;
}) {
  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[34px] border border-white bg-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 px-6 py-12 text-center text-white sm:px-10">
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-blue-900/20 blur-2xl" />

        <div className="relative">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white text-emerald-600 shadow-2xl">
            <IconoCheck className="h-12 w-12" />
          </div>

          <p className="mt-7 text-sm font-black uppercase tracking-[0.22em] text-emerald-100">
            Expediente recibido
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            ¡Tu bazar ya está en proceso!
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-emerald-50">
            {mensaje}
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        <div className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Folio de registro
            </p>

            <p className="mt-3 text-4xl font-black tracking-wider text-[#072c74]">
              {folio}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Guarda una captura de este folio para cualquier
              aclaración o seguimiento.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="font-black text-slate-950">
              ¿Qué sucede ahora?
            </p>

            <div className="mt-5 space-y-4">
              <PasoExito
                numero="1"
                titulo="Revisión de información"
                texto="VIPACK verificará los datos y documentos enviados."
              />

              <PasoExito
                numero="2"
                titulo="Validación administrativa"
                texto="El expediente permanecerá pendiente durante la revisión."
              />

              <PasoExito
                numero="3"
                titulo="Confirmación"
                texto="Al aprobarse, el bazar podrá operar como negocio registrado."
              />
            </div>
          </div>
        </div>

        <div className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
              <IconoInfo />
            </div>

            <div>
              <p className="font-black text-amber-950">
                Importante
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Registrarte no significa aprobación automática. El
                equipo de VIPACK revisará el expediente antes de
                cambiarlo a estado activo.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={registrarOtro}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#072c74] px-6 py-4 text-lg font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-900"
        >
          <IconoMas className="h-5 w-5" />
          Registrar otro bazar
        </button>
      </div>
    </section>
  );
}

function SeccionFormulario({
  numero,
  titulo,
  subtitulo,
  icono,
  children,
}: {
  numero: string;
  titulo: string;
  subtitulo: string;
  icono: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-md">
          {icono}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Paso {numero}
            </span>
          </div>

          <h3 className="mt-1 text-xl font-black text-slate-950">
            {titulo}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {subtitulo}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {children}
      </div>
    </section>
  );
}

type CampoProps = {
  etiqueta: string;
  nombre: keyof FormularioBazar;
  valor: string;
  tipo?: string;
  placeholder?: string;
  requerido?: boolean;
  inputMode?:
    | "text"
    | "search"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "none";
  maxLength?: number;
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
  inputMode,
  maxLength,
  onChange,
}: CampoProps) {
  return (
    <div>
      <label
        htmlFor={nombre}
        className="mb-2 block text-sm font-black text-slate-800"
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
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function CargaArchivo({
  id,
  etiqueta,
  ayuda,
  archivo,
  onChange,
  formatearTamano,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  archivo: File | null;
  onChange: (archivo: File | null) => void;
  formatearTamano: (bytes: number) => string;
}) {
  return (
    <div
      className={`rounded-3xl border-2 border-dashed p-5 transition ${
        archivo
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            archivo
              ? "bg-emerald-600 text-white"
              : "bg-white text-blue-700 shadow-sm"
          }`}
        >
          {archivo ? (
            <IconoCheck />
          ) : (
            <IconoSubir />
          )}
        </div>

        <div>
          <p className="font-black text-slate-900">
            {etiqueta}
            <span className="ml-1 text-red-600">*</span>
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {ayuda}
          </p>
        </div>
      </div>

      <label
        htmlFor={id}
        className={`mt-5 flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition ${
          archivo
            ? "bg-white text-emerald-800 shadow-sm hover:bg-emerald-100"
            : "bg-[#072c74] text-white shadow-md hover:bg-blue-900"
        }`}
      >
        {archivo
          ? "Cambiar archivo"
          : "Seleccionar archivo"}
      </label>

      <input
        id={id}
        name={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required={!archivo}
        onChange={(evento) =>
          onChange(evento.target.files?.[0] || null)
        }
        className="sr-only"
      />

      {archivo && (
        <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
          <p className="break-all text-sm font-bold text-slate-800">
            {archivo.name}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {formatearTamano(archivo.size)}
          </p>
        </div>
      )}
    </div>
  );
}

function BeneficioRapido({
  icono,
  titulo,
  texto,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        {icono}
      </div>

      <div>
        <p className="text-sm font-black text-white">
          {titulo}
        </p>
        <p className="text-xs text-blue-100">{texto}</p>
      </div>
    </div>
  );
}

function PasoLateral({
  numero,
  titulo,
  texto,
}: {
  numero: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-300">
        {numero}
      </span>

      <div>
        <p className="text-sm font-black">{titulo}</p>
        <p className="mt-1 text-xs leading-5 text-blue-200">
          {texto}
        </p>
      </div>
    </div>
  );
}

function PasoExito({
  numero,
  titulo,
  texto,
}: {
  numero: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#072c74] text-xs font-black text-white">
        {numero}
      </span>

      <div>
        <p className="text-sm font-black text-slate-900">
          {titulo}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {texto}
        </p>
      </div>
    </div>
  );
}

function DecoracionFondo() {
  return (
    <>
      <div className="pointer-events-none absolute -left-32 top-28 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-[520px] h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 h-64 w-64 rounded-full bg-emerald-200/20 blur-3xl" />
    </>
  );
}

function IconoBase({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconoPaquete({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="m7.5 4.3 9 5.2" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </IconoBase>
  );
}

function IconoReloj({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconoBase>
  );
}

function IconoEscudo({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconoBase>
  );
}

function IconoDocumento({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </IconoBase>
  );
}

function IconoLista() {
  return (
    <IconoBase>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </IconoBase>
  );
}

function IconoCandado() {
  return (
    <IconoBase>
      <rect width="14" height="10" x="5" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </IconoBase>
  );
}

function IconoUsuario() {
  return (
    <IconoBase>
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </IconoBase>
  );
}

function IconoTienda() {
  return (
    <IconoBase>
      <path d="M3 9l2-5h14l2 5" />
      <path d="M5 13v8h14v-8" />
      <path d="M9 21v-6h6v6" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </IconoBase>
  );
}

function IconoContactos() {
  return (
    <IconoBase>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconoBase>
  );
}

function IconoInfo({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </IconoBase>
  );
}

function IconoAlerta({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </IconoBase>
  );
}

function IconoEnviar({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </IconoBase>
  );
}

function IconoSubir() {
  return (
    <IconoBase>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </IconoBase>
  );
}

function IconoCheck({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="m5 12 4 4L19 6" />
    </IconoBase>
  );
}

function IconoMas({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconoBase>
  );
}
