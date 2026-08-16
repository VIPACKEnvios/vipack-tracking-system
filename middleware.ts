import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const auth =
    request.cookies.get("vipack-auth")?.value;

  const path = request.nextUrl.pathname;

  /*
   * PÁGINAS PÚBLICAS
   */
  const isPublicPage =
    path === "/login" ||
    path === "/registro-bazar" ||
    path === "/consulta-bazares";

  /*
   * APIs PÚBLICAS
   *
   * IMPORTANTE:
   * TrackingMore necesita entrar al webhook
   * sin tener la cookie vipack-auth.
   *
   * La seguridad del webhook se controla con:
   * TRACKINGMORE_WEBHOOK_SECRET
   */
  const isPublicApi =
    path === "/api/login" ||
    path.startsWith("/api/registro-bazar") ||
    path.startsWith("/api/consulta-bazares") ||
    path === "/api/trackingmore/webhook";

  /*
   * Permitir páginas y APIs públicas.
   */
  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  /*
   * Para APIs privadas sin sesión,
   * devolver 401 en vez de redirigir al login.
   */
  if (
    path.startsWith("/api/") &&
    !auth
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "No autorizado",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * Para páginas privadas sin sesión,
   * enviar al login.
   */
  if (!auth) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};