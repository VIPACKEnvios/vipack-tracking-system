import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    metodo: "GET",
  });
}

export async function POST() {
  return NextResponse.json({
    success: true,
    metodo: "POST",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}