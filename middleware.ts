import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const auth = request.cookies.get("vipack-auth")?.value;
  const path = request.nextUrl.pathname;

  const isLoginPage = path === "/login";
  const isLoginApi = path === "/api/login";

  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};