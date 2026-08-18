import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isPublicPage =
    path === "/login" ||
    path === "/registro-bazar" ||
    path === "/consulta-bazares" ||
    path === "/informacion" ||
    path.startsWith("/informacion/") ||
    path.startsWith("/inventario/");

  const isPublicApi =
    path === "/api/login" ||
    path.startsWith("/api/registro-bazar") ||
    path.startsWith("/api/consulta-bazares") ||
    path.startsWith("/api/trackingmore/") ||
    path === "/api/onedrive/login" ||
    path === "/api/onedrive/callback" ||
    path === "/api/onedrive/sync-clientes" ||
    path.startsWith("/api/inventario/");

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("vipack-auth")?.value;

  if (path.startsWith("/api/") && !auth) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    );
  }

  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};