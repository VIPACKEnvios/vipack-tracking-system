"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useMemo,
  useState,
} from "react";

type FormularioCliente = {
  nombre: string;
  telefono: string;
  direccion: string;
  referencia_domicilio: string;
};

type RespuestaRegistro = {
  success?: boolean;
  error?: string;
  folio?: string;
};

const formularioInicial: FormularioCliente = {
  nombre: "",
  telefono: "",
  direccion: "",
  referencia_domicilio: "",
};

export default function RegistroClientePage() {
  const [formulario, setFormulario] =
    useState<FormularioCliente>(formularioInicial);

  const [enviando, setEnviando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [registroExitoso, setRegistroExitoso] =
    useState(false);

  const [folio, setFolio] =
    useState("");

  const avanceFormulario =
    useMemo(() => {
      const campos = [
        formulario.nombre,
        formulario.telefono,
        formulario.direccion,
        formulario.referencia_domicilio,
      ];

      const completados =
        campos.filter(
          (valor) =>
            valor.trim().length > 0
        ).length;

      return Math.round(
        (completados / campos.length) *
          100
      );
    }, [formulario]);

  function actualizarCampo(
    evento:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
  ) {
    const {
      name,
      value,
    } = evento.target;

    setFormulario(
      (anterior) => ({
        ...anterior,
        [name]: value,
      })
    );
  }

  function limpiarTelefono(
    valor: string
  ) {
    return valor.replace(
      /\D/g,
      ""
    );
  }

  async function enviarFormulario(
    evento:
      FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (enviando) {
      return;
    }

    setMensaje("");
    setRegistroExitoso(false);
    setFolio("");

    try {
      setEnviando(true);

      const telefono =
        limpiarTelefono(
          formulario.telefono
        );

      if (
        telefono.length !== 10
      ) {
        throw new Error(
          "Ingresa un número de teléfono válido de 10 dígitos."
        );
      }

      const response =
        await fetch(
          "/api/registro-cliente",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                nombre:
                  formulario.nombre.trim(),
                telefono,
                direccion:
                  formulario.direccion.trim(),
                referencia_domicilio:
                  formulario
                    .referencia_domicilio
                    .trim(),
              }),
          }
        );

      let data:
        RespuestaRegistro;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          "El servidor no devolvió una respuesta válida."
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No fue posible enviar tu registro."
        );
      }

      setFormulario(
        formularioInicial
      );

      setFolio(
        data.folio || ""
      );

      setRegistroExitoso(
        true
      );

      setMensaje(
        "Tus datos fueron enviados correctamente a VIPACK Envíos."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible enviar tu registro."
      );
    } finally {
      setEnviando(false);
    }
  }

  function registrarOtro() {
    setRegistroExitoso(
      false
    );
    setMensaje("");
    setFolio("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f7fc] text-slate-900">
      <DecoracionFondo />

      <div className="relative mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6 md:py-10">
        <header className="mb-5 overflow-hidden rounded-[24px] sm:rounded-[30px] bg-gradient-to-br from-[#031b46] via-[#073b86] to-[#05a9b8] text-white shadow-[0_24px_70px_rgba(3,27,70,0.25)]">
          <div className="grid gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 md:grid-cols-[1.3fr_0.7fr] md:px-10 md:py-10">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur sm:h-16 sm:w-16">
                <IconoUsuario className="h-8 w-8 sm:h-9 sm:w-9" />
              </div>

              <div>
                <span className="inline-flex rounded-full border border-cyan-200/40 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                  Registro de clientes VIPACK
                </span>

                <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl md:text-5xl">
                  Bienvenido a VIPACK
                  <span className="block text-cyan-200">
                    Tu registro comienza aquí
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Regístrate en VIPACK y mantén tus compras más organizadas.
                  Cuando realices tu primera compra, activaremos tu carpeta
                  personal de inventario.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-1">
              <BeneficioRapido
                icono={
                  <IconoReloj />
                }
                titulo="1–2 minutos"
                texto="Registro rápido"
              />

              <BeneficioRapido
                icono={
                  <IconoEscudo />
                }
                titulo="Datos protegidos"
                texto="Uso interno"
              />

              <BeneficioRapido
                icono={
                  <IconoCheck />
                }
                titulo="Primera compra"
                texto="Activa tu carpeta"
              />
            </div>
          </div>
        </header>

        {registroExitoso ? (
          <section className="min-w-0 overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:rounded-[30px]">
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 px-6 py-10 text-center text-white">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-emerald-600 shadow-xl">
                <IconoCheck className="h-10 w-10" />
              </div>

              <h2 className="mt-5 text-3xl font-black">
                ¡Registro completado!
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-emerald-50">
                {mensaje}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              {folio && (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Folio
                  </p>
                  <p className="mt-2 text-3xl font-black text-[#072c74]">
                    {folio}
                  </p>
                </div>
              )}

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-black text-slate-950">
                  ¿Qué sigue?
                </p>

                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <p>
                    1. Tu información ya quedó registrada en VIPACK.
                  </p>
                  <p>
                    2. Con tu primera compra crearemos tu número de cliente
                    y tu carpeta personal de inventario.
                  </p>
                  <p>
                    3. Desde ahí podrás consultar evidencias y llevar un
                    mejor control de tu mercancía.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  registrarOtro
                }
                className="mt-6 w-full rounded-2xl bg-[#072c74] px-6 py-4 text-base font-black text-white shadow-lg transition hover:bg-blue-900"
              >
                Registrar otro cliente
              </button>
            </div>
          </section>
        ) : (
          <div className="grid min-w-0 items-start gap-4 sm:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-6">
              <section className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Registro en progreso
                </p>

                <p className="mt-1 text-2xl font-black text-slate-950">
                  {avanceFormulario}%
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500 transition-all duration-500"
                    style={{
                      width:
                        `${avanceFormulario}%`,
                    }}
                  />
                </div>
              </section>

              <section className="rounded-3xl bg-[#061b43] p-5 text-white shadow-[0_18px_45px_rgba(6,27,67,0.18)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
                  Importante
                </p>

                <p className="mt-3 text-sm leading-6 text-blue-100">
                  Al registrarte, tus datos quedarán listos para comenzar.
                  En cuanto realices tu primera compra, crearemos tu carpeta
                  personal para organizar tu mercancía desde su llegada.
                </p>

                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-white/10 p-3">
                  <p className="text-xs font-bold leading-5 text-cyan-100">
                    📦 Desde tu primera compra podrás consultar evidencias y
                    mantener un mejor control de tu mercancía en línea.
                  </p>
                </div>
              </section>
            </aside>

            <form
              onSubmit={
                enviarFormulario
              }
              className="min-w-0 overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:rounded-[30px]"
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50 px-5 py-5 sm:px-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Tu registro
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Cuéntanos dónde recibirás tus envíos
                </h2>
              </div>

              <div className="space-y-6 p-4 sm:space-y-7 sm:p-8">
                <SeccionFormulario
                  numero="01"
                  titulo="Datos personales"
                  subtitulo="Nombre y teléfono de contacto."
                  icono={
                    <IconoUsuario />
                  }
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Campo
                      etiqueta="Nombre completo"
                      nombre="nombre"
                      valor={
                        formulario.nombre
                      }
                      onChange={
                        actualizarCampo
                      }
                      placeholder="Nombre y apellidos"
                      requerido
                    />

                    <Campo
                      etiqueta="Número de teléfono / WhatsApp"
                      nombre="telefono"
                      valor={
                        formulario.telefono
                      }
                      onChange={
                        actualizarCampo
                      }
                      tipo="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Ejemplo: 6641234567"
                      requerido
                    />
                  </div>
                </SeccionFormulario>

                <SeccionFormulario
                  numero="02"
                  titulo="Domicilio"
                  subtitulo="Dirección donde normalmente recibirás tus envíos."
                  icono={
                    <IconoUbicacion />
                  }
                >
                  <div className="space-y-5">
                    <div>
                      <label
                        htmlFor="direccion"
                        className="mb-2 block text-sm font-black text-slate-800"
                      >
                        Dirección completa
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <textarea
                        id="direccion"
                        name="direccion"
                        value={
                          formulario.direccion
                        }
                        onChange={
                          actualizarCampo
                        }
                        required
                        rows={4}
                        placeholder="Calle, número exterior/interior, colonia, código postal, ciudad, municipio y estado"
                        className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="referencia_domicilio"
                        className="mb-2 block text-sm font-black text-slate-800"
                      >
                        Referencia del domicilio
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <textarea
                        id="referencia_domicilio"
                        name="referencia_domicilio"
                        value={
                          formulario
                            .referencia_domicilio
                        }
                        onChange={
                          actualizarCampo
                        }
                        required
                        rows={3}
                        placeholder="Ejemplo: casa color blanco, portón negro, frente a una farmacia"
                        className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:text-sm"
                      />
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
                    Confirmo que la información proporcionada
                    es correcta y autorizo a VIPACK Envíos a
                    utilizarla para fines de registro,
                    operación y envío.
                  </span>
                </label>

                {mensaje &&
                  !registroExitoso && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
                    >
                      {mensaje}
                    </div>
                  )}

                <button
                  type="submit"
                  disabled={
                    enviando
                  }
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5 text-lg font-black text-white shadow-[0_16px_35px_rgba(5,150,105,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {enviando
                    ? "Enviando registro..."
                    : "Crear mi registro VIPACK"}
                </button>
              </div>
            </form>
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-slate-500">
          <p className="font-bold text-slate-700">
            VIPACK Envíos
          </p>
          <p className="mt-1">
            Registro de clientes
          </p>
        </footer>
      </div>
    </main>
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

        <div>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            Paso {numero}
          </span>

          <h3 className="mt-1 text-xl font-black text-slate-950">
            {titulo}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {subtitulo}
          </p>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        {children}
      </div>
    </section>
  );
}

type CampoProps = {
  etiqueta: string;
  nombre:
    | "nombre"
    | "telefono";
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
    evento:
      ChangeEvent<HTMLInputElement>
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
          <span className="ml-1 text-red-600">
            *
          </span>
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
        className="w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:text-sm"
      />
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
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-2.5 text-center backdrop-blur sm:p-3 md:flex-row md:text-left">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-10 sm:w-10">
        {icono}
      </div>

      <div>
        <p className="text-[11px] font-black leading-tight text-white sm:text-sm">
          {titulo}
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-blue-100 sm:text-xs">
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
  className =
    "h-5 w-5",
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

function IconoUsuario({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase
      className={
        className
      }
    >
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle
        cx="12"
        cy="7"
        r="4"
      />
    </IconoBase>
  );
}

function IconoReloj() {
  return (
    <IconoBase>
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 7v5l3 2" />
    </IconoBase>
  );
}

function IconoEscudo() {
  return (
    <IconoBase>
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconoBase>
  );
}

function IconoCheck({
  className,
}: {
  className?: string;
}) {
  return (
    <IconoBase
      className={
        className
      }
    >
      <path d="m5 12 4 4L19 6" />
    </IconoBase>
  );
}

function IconoUbicacion() {
  return (
    <IconoBase>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    </IconoBase>
  );
}