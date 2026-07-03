import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const pathname = request.nextUrl.pathname;
  const dashboardRoots = ["/workflows", "/executions", "/credentials", "/mcp"];
  const isDashboardPage = dashboardRoots.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isDashboardPage && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackURL", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logos).*)"],
};
