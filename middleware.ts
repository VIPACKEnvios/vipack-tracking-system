import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const auth =
    request.cookies.get("vipack-auth")?.value;

  const path = request.nextUrl.pathname;

  const isPublicPage =
    path === "/login" ||
    path === "/registro-bazar" ||
    path === "/consulta-bazares";

  const isPublicApi =
    path === "/api/login" ||
    path.startsWith("/api/registro-bazar") ||
    path.startsWith("/api/consulta-bazares");

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

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