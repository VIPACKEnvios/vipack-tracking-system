
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verificarSesionAdmin } from "@/lib/vipack-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EnvioPDF = {
  id: number;
  cliente: string | null;
  pdf: string | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan las variables de conexión de Supabase."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  // Validar sesión administrativa.
  if (!verificarSesionAdmin(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Sesión no autorizada.",
      },
      {
        status: 401,
        headers: HEADERS,
      }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const idTexto = request.nextUrl.searchParams.get("id");

    // Consultar un envío específico.
    if (idTexto !== null) {
      const id = Number(idTexto);

      if (
        !/^\d+$/.test(idTexto) ||
        !Number.isSafeInteger(id) ||
        id <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "ID de envío inválido.",
          },
          {
            status: 400,
            headers: HEADERS,
          }
        );
      }

      const { data, error } = await supabase
        .from("envios")
        .select("id, cliente, pdf")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return NextResponse.json(
        {
          success: true,
          envio: (data as EnvioPDF | null) ?? null,
        },
        {
          headers: HEADERS,
        }
      );
    }

    // Consultar todos los envíos con PDF.
    const envios: EnvioPDF[] = [];

    const TAMANO_PAGINA = 500;
    const MAX_PAGINAS = 200;

    let desde = 0;

    for (
      let paginaNumero = 0;
      paginaNumero < MAX_PAGINAS;
      paginaNumero++
    ) {
      const { data, error } = await supabase
        .from("envios")
        .select("id, cliente, pdf")
        .not("pdf", "is", null)
        .order("id", { ascending: false })
        .range(
          desde,
          desde + TAMANO_PAGINA - 1
        );

      if (error) {
        throw error;
      }

      const pagina = (data ?? []) as EnvioPDF[];

      envios.push(...pagina);

      if (pagina.length < TAMANO_PAGINA) {
        return NextResponse.json(
          {
            success: true,
            total: envios.length,
            envios,
          },
          {
            headers: HEADERS,
          }
        );
      }

      desde += TAMANO_PAGINA;
    }

    throw new Error(
      "Se alcanzó el límite de paginación de envíos."
    );
  } catch (error) {
    console.error(
      "Error consultando envíos PDF:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "No fue posible consultar los envíos.",
      },
      {
        status: 500,
        headers: HEADERS,
      }
    );
  }
}
