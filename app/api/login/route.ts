import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { usuario, password } = await req.json();

    const userOk = process.env.VIPACK_USER;
    const passOk = process.env.VIPACK_PASSWORD;

    if (usuario === userOk && password === passOk) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false });
  } catch {
    return NextResponse.json(
      { success: false, error: "Error en login" },
      { status: 500 }
    );
  }
}