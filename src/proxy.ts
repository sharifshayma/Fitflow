import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Pages reachable without a session. Everything else redirects to /login.
// (API routes, /.well-known and static assets are excluded by the matcher below;
// API routes validate the session themselves via getUserId.)
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/authorize"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Optimistic cookie check (no DB round-trip). Full validation happens in the
  // route/page; this only gates the redirect.
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
