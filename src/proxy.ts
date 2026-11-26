import { NextResponse, type NextRequest } from "next/server";
import { isKnownPath, knownRoutes } from "@/lib/catalog/routes";

/**
 * 1. /admin: optimistic gate (no cookie → login page). Real verification happens in requireAdmin().
 * 2. /p, /catalog, /info: unknown slugs get a real HTTP 404 (rewritten to a path no route matches,
 *    so Next renders app/not-found.tsx with status 404) instead of a streamed "not found" with 200.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || request.cookies.get("admin_session")?.value) return NextResponse.next();
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    if (!isKnownPath(pathname, await knownRoutes())) {
      return NextResponse.rewrite(new URL("/_not-found-route", request.url));
    }
  } catch (e) {
    console.error("proxy: catalog unavailable, letting the page decide", e);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/p/:path*", "/catalog/:path*", "/info/:path*"] };
