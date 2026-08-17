  "use client";

    import { useEffect, useState } from "react";
    import { useParams } from "next/navigation";

    type InventarioItem = {
    id: string;
    nombre: string;
    tipo: string;
    mime_type: string | null;
    tamaño: number;
    modificado: string | null;
    webUrl: string | null;
    };

    type InventarioResponse = {
    success: boolean;
    cliente?: {
        id_cliente: number;
        nombre: string;
        carpeta: string;
    };
    total?: number;
    inventario?: InventarioItem[];
    error?: string;
    };

    function formatearFecha(fecha: string | null) {
    if (!fecha) return "";

    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(fecha));
    }

    function formatearTamaño(bytes: number) {
    if (!bytes) return "";

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
        bytes /
        1024 /
        1024
    ).toFixed(1)} MB`;
    }

    export default function InventarioClientePage() {
    const params = useParams();

    const token =
        typeof params.token === "string"
        ? params.token
        : Array.isArray(params.token)
        ? params.token[0]
        : "";

    const [data, setData] =
        useState<InventarioResponse | null>(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        if (!token) {
        return;
        }

        const cargarInventario =
        async () => {
            try {
            setLoading(true);

            const response =
                await fetch(
                `/api/inventario/${encodeURIComponent(
                    token
                )}`,
                {
                    cache: "no-store",
                }
                );

            const result =
                await response.json();

            setData(result);
            } catch {
            setData({
                success: false,
                error:
                "No se pudo cargar el inventario.",
            });
            } finally {
            setLoading(false);
            }
        };

        cargarInventario();
    }, [token]);

    if (loading) {
        return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
            <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#072c74]" />

                <p className="mt-5 text-lg font-semibold text-slate-600">
                Cargando inventario...
                </p>
            </div>
            </div>
        </main>
        );
    }

    if (
        !data ||
        !data.success
    ) {
        return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
            <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
                !
                </div>

                <h1 className="mt-5 text-2xl font-black text-slate-900">
                Inventario no disponible
                </h1>

                <p className="mt-3 text-slate-500">
                {data?.error ||
                    "No fue posible abrir este inventario."}
                </p>
            </div>
            </div>
        </main>
        );
    }

    const inventario =
        data.inventario || [];

    const imagenes =
        inventario.filter(
        (item) =>
            item.mime_type?.startsWith(
            "image/"
            )
        );

    const otrosArchivos =
        inventario.filter(
        (item) =>
            !item.mime_type?.startsWith(
            "image/"
            )
        );

    return (
        <main className="min-h-screen bg-slate-50">
        <header className="bg-[#072c74] text-white shadow-sm">
            <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">
                    VIPACK Envíos
                </p>

                <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                    Mi inventario
                </h1>
                </div>

                <div className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur">
                Cliente #
                {String(
                    data.cliente
                    ?.id_cliente || ""
                ).padStart(
                    5,
                    "0"
                )}
                </div>
            </div>
            </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Inventario de
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
                {data.cliente?.nombre}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">
                    Archivos
                </p>

                <p className="mt-1 text-3xl font-black text-[#072c74]">
                    {data.total || 0}
                </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">
                    Fotos
                </p>

                <p className="mt-1 text-3xl font-black text-[#072c74]">
                    {imagenes.length}
                </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">
                    Otros archivos
                </p>

                <p className="mt-1 text-3xl font-black text-[#072c74]">
                    {otrosArchivos.length}
                </p>
                </div>
            </div>
            </div>

            <div className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    Evidencias
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                    Fotos de recolección
                </h2>
                </div>

                <p className="text-sm font-semibold text-slate-500">
                {imagenes.length} fotos
                </p>
            </div>

            {imagenes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                Aún no hay fotos disponibles.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {imagenes.map(
                    (item) => (
                    <article
                        key={item.id}
                        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <div className="flex aspect-square items-center justify-center overflow-hidden bg-slate-100">
                          <img
                            src={`/api/inventario/${encodeURIComponent(
                              token
                            )}/archivo/${encodeURIComponent(
                              item.id
                            )}`}
                            alt={item.nombre}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="p-5">
                        <p className="truncate font-bold text-slate-900">
                            {item.nombre}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                            <span>
                            {formatearFecha(
                                item.modificado
                            )}
                            </span>

                            <span>
                            {formatearTamaño(
                                item.tamaño
                            )}
                            </span>
                        </div>
                        </div>
                    </article>
                    )
                )}
                </div>
            )}
            </div>

            {otrosArchivos.length >
            0 && (
            <div className="mt-10">
                <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Documentos
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                Otros archivos
                </h2>

                <div className="mt-5 space-y-3">
                {otrosArchivos.map(
                    (item) => (
                    <a
                        key={item.id}
                        href={
                        item.webUrl ||
                        "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#072c74]"
                    >
                        <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                            {
                            item.nombre
                            }
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            {formatearFecha(
                            item.modificado
                            )}
                        </p>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-[#072c74]">
                        Abrir
                        </span>
                    </a>
                    )
                )}
                </div>
            </div>
            )}

            <footer className="mt-12 border-t border-slate-200 py-8 text-center">
            <p className="text-sm text-slate-500">
                Inventario administrado por
                <span className="font-bold text-[#072c74]">
                {" "}
                VIPACK Envíos
                </span>
            </p>
            </footer>
        </section>
        </main>
    );
    }