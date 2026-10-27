import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

// Optimistic check only: the cookie's presence skips an extra round trip to the login page.
// The API still validates every request, and the client re-checks the session on load.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = request.cookies.has("access_token");
  if (!signedIn && pathname !== "/" && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\..*).*)"],
};
