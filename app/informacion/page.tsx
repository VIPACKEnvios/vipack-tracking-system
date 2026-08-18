import Link from "next/link";

function IconoCaja({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function IconoCamion({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M3 6h11v10H3V6Z" />
      <path d="M14 9h4l3 3v4h-7V9Z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function IconoBolsa({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M5 8h14l1 12H4L5 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function IconoTienda({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 10h16v10H4V10Z" />
      <path d="M3 10 5 4h14l2 6" />
      <path d="M8 20v-6h5v6" />
      <path d="M3 10c1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0" />
    </svg>
  );
}

function IconoDocumento({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h5M10 16h5" />
    </svg>
  );
}

function IconoEscudo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconoFlecha({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

const accesos = [
  { titulo: "Cómo funcionan los envíos", descripcion: "Conoce el proceso desde la recolección hasta la entrega de tu paquete.", href: "#envios", icono: IconoCamion, etiqueta: "Envíos" },
  { titulo: "Cómo realizar tus compras", descripcion: "Revisa qué datos debes proporcionar y cómo identificar correctamente tu mercancía.", href: "#compras", icono: IconoBolsa, etiqueta: "Compras" },
  { titulo: "Bodegas y bazares confiables", descripcion: "Consulta establecimientos y bazares registrados para comprar con mayor confianza.", href: "#confianza", icono: IconoTienda, etiqueta: "Directorio" },
  { titulo: "Términos y condiciones", descripcion: "Consulta las reglas de servicio, responsabilidades y condiciones de operación.", href: "#terminos", icono: IconoDocumento, etiqueta: "Legal" },
];

export default function InformacionPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#061f58] via-[#0a3183] to-[#0b57d0] text-white">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute left-[-80px] top-32 h-64 w-64 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-5 sm:px-6 sm:pb-28 sm:pt-7 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <IconoCaja className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black tracking-[0.16em]">VIPACK ENVÍOS</p>
                <p className="text-xs font-medium text-blue-100/80">Centro de información</p>
              </div>
            </div>

            <Link href="/consulta-bazares" className="hidden rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15 sm:inline-flex">
              Consultar bazares
            </Link>
          </nav>

          <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-14">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Información para clientes</span>
              <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">Todo lo que necesitas saber antes de comprar y enviar con VIPACK.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100/85 sm:text-lg sm:leading-8">Consulta la dinámica de compras, recolecciones, envíos, bazares registrados, recomendaciones y condiciones del servicio desde un solo lugar.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#accesos" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#0a3183] shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5">Ver información<IconoFlecha /></a>
                <Link href="/consulta-bazares" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15 sm:hidden">Consultar bazares</Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-3 rounded-[34px] bg-cyan-300/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-blue-950/30 backdrop-blur-xl sm:p-6">
                <div className="rounded-[24px] bg-white p-5 text-slate-950 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">Tu guía VIPACK</p>
                      <h2 className="mt-2 text-2xl font-black">Compra con información. Envía con confianza.</h2>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0a3183]"><IconoEscudo className="h-7 w-7" /></div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {["Conoce el proceso antes de comprar.","Identifica correctamente tu mercancía.","Consulta bazares registrados.","Revisa condiciones antes de enviar."].map((texto) => (
                      <div key={texto} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">✓</span><p className="text-sm font-semibold leading-6 text-slate-700">{texto}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="accesos" className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {accesos.map((item) => {
            const Icono = item.icono;
            return (
              <a key={item.titulo} href={item.href} className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
                <div className="flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0a3183] transition group-hover:bg-[#0a3183] group-hover:text-white"><Icono className="h-6 w-6" /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{item.etiqueta}</span></div>
                <h3 className="mt-5 text-lg font-black leading-tight text-slate-950">{item.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.descripcion}</p>
                <div className="mt-5 flex items-center gap-2 text-sm font-black text-[#0a3183]">Ver información<IconoFlecha className="h-4 w-4 transition group-hover:translate-x-1" /></div>
              </a>
            );
          })}
        </div>
      </section>

      <section id="envios" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Envíos</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">¿Cómo funciona el proceso?</h2><p className="mt-4 max-w-xl text-base leading-7 text-slate-500">Una guía rápida para entender qué pasa desde que realizas una compra hasta que tu paquete queda listo para envío.</p></div>
          <div className="space-y-4">
            {[["01","Realiza tu compra","Compra con la bodega o bazar y proporciona correctamente tus datos de identificación."],["02","Solicita recolección","VIPACK recibe la solicitud y programa la recolección de tu mercancía."],["03","Recibimos e identificamos","La mercancía se identifica para relacionarla con tu inventario y cliente."],["04","Evidencia e inventario","Las evidencias disponibles se agregan al inventario del cliente."],["05","Empaque y cotización","La mercancía se prepara y se determina el servicio de envío correspondiente."],["06","Envío","Una vez confirmado el proceso, el paquete continúa con la paquetería seleccionada."]].map(([numero,titulo,descripcion]) => (
              <div key={numero} className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[70px_minmax(0,1fr)] sm:p-6"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a3183] to-[#1477f8] text-lg font-black text-white shadow-lg shadow-blue-200/60">{numero}</div><div><h3 className="text-lg font-black text-slate-950">{titulo}</h3><p className="mt-1.5 text-sm leading-6 text-slate-500">{descripcion}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      <section id="compras" className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="grid gap-8 lg:grid-cols-2 lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Compras</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Compra de forma ordenada y fácil de identificar.</h2><p className="mt-4 text-base leading-7 text-slate-500">Antes de pagar, confirma cómo debe ir identificada tu compra y conserva comprobantes, nombre del bazar y cualquier referencia relacionada con tu pedido.</p></div><div className="grid gap-3 sm:grid-cols-2">{["Usa siempre tu número o nombre de cliente.","Confirma quién entrega la mercancía.","Conserva comprobantes de compra.","Evita mercancía sin identificación.","Revisa condiciones del bazar antes de pagar.","Consulta tu inventario cuando tengas acceso."].map((texto)=><div key={texto} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span><p className="text-sm font-bold leading-6 text-slate-700">{texto}</p></div></div>)}</div></div></div></section>

      <section id="confianza" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="rounded-[30px] bg-gradient-to-br from-[#071f57] via-[#0a3183] to-[#0b57d0] p-5 text-white shadow-2xl shadow-blue-200/60 sm:p-8 lg:p-10"><div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Compra con mayor confianza</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Consulta nuestros directorios.</h2><p className="mt-4 max-w-2xl text-base leading-7 text-blue-100/85">Revisa bazares registrados en VIPACK y, próximamente, una selección de bodegas recomendadas para compras.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:min-w-[430px]"><Link href="/consulta-bazares" className="rounded-2xl bg-white p-5 text-[#0a3183] transition hover:-translate-y-1"><IconoTienda className="h-7 w-7" /><p className="mt-4 text-lg font-black">Bazares registrados</p><p className="mt-1 text-sm font-semibold text-slate-500">Consulta los registros disponibles.</p></Link><Link href="/informacion/bodegas" className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"><IconoEscudo className="h-7 w-7" /><p className="mt-4 text-lg font-black">Bodegas confiables</p><p className="mt-1 text-sm font-semibold text-blue-100/80">Directorio en preparación.</p></Link></div></div></div></section>

      <section id="terminos" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Términos y condiciones</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Consulta las condiciones antes de utilizar el servicio.</h2><p className="mt-3 text-sm leading-6 text-slate-500">Aquí podrás consultar las políticas relacionadas con compras, recolecciones, almacenamiento, empaque, envíos y responsabilidades.</p></div><Link href="/informacion/terminos" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0a3183] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition hover:bg-[#0d42ad]">Ver términos<IconoFlecha /></Link></div></div></section>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-center sm:px-6 md:flex-row md:items-center md:justify-between md:text-left lg:px-8"><div><p className="font-black text-[#0a3183]">VIPACK Envíos</p><p className="mt-1 text-xs text-slate-400">Centro de información para clientes.</p></div><div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500 md:justify-end"><a href="#envios" className="hover:text-[#0a3183]">Envíos</a><a href="#compras" className="hover:text-[#0a3183]">Compras</a><Link href="/consulta-bazares" className="hover:text-[#0a3183]">Bazares</Link><a href="#terminos" className="hover:text-[#0a3183]">Términos</a></div></div></footer>
    </main>
  );
}