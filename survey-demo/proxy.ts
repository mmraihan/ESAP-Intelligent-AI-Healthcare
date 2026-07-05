import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/survey", "/register"];

// Optimistic check only — reads the non-httpOnly "logged in" cookie set on
// login. Real authorization happens server-side on every esap-api call via
// the bearer token, which this cookie has no bearing on.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const isLoggedIn = request.cookies.get("esap_auth")?.value === "1";
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/survey/:path*", "/register/:path*"],
};
