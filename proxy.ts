import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  /*
   * RUTAS PÚBLICAS
   */
  const isPublicPage =
    path === "/login" ||
    path === "/registro-bazar" ||
    path === "/consulta-bazares" ||

    /*
     * Inventario privado por token.
     * No requiere login del ERP.
     * El token del enlace identifica al cliente.
     */
    path.startsWith("/inventario/");

  /*
   * APIs PÚBLICAS
   */
  const isPublicApi =
    path === "/api/login" ||
    path.startsWith("/api/registro-bazar") ||
    path.startsWith("/api/consulta-bazares") ||
    path.startsWith("/api/trackingmore/") ||

    /*
     * Microsoft OneDrive
     */
    path === "/api/onedrive/login" ||
    path === "/api/onedrive/callback" ||
    path === "/api/onedrive/sync-clientes" ||

    /*
     * Inventario privado por token.
     * No requiere cookie de administrador.
     * La propia API valida token_inventario.
     */
    path.startsWith("/api/inventario/");

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  const auth =
    request.cookies.get("vipack-auth")?.value;

  /*
   * APIs privadas:
   * devolver 401, nunca redirigir.
   */
  if (path.startsWith("/api/") && !auth) {
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
   * Páginas privadas:
   * mandar a login.
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