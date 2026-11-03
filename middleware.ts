import { NextResponse, type NextRequest } from "next/server";

/**
 * Pages and APIs that need a signed-in teacher when a database is configured.
 * The middleware only checks that a session cookie exists (it can't reach the database);
 * pages and API routes validate the session properly.
 */
const PROTECTED = ["/plan", "/plans", "/templates", "/usage", "/settings", "/api/generate", "/api/refine", "/api/generations", "/api/templates", "/api/budget"];
const SESSION_COOKIE = "eda_session";

export function middleware(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next(); // local mode: no accounts
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (!isProtected || request.cookies.get(SESSION_COOKIE)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
