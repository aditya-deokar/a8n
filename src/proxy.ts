import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function requestIdFor(request: NextRequest) {
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-vercel-id") ||
    crypto.randomUUID()
  );
}

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function proxy(request: NextRequest) {
  const requestId = requestIdFor(request);
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
    return withRequestId(NextResponse.redirect(loginUrl), requestId);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  return withRequestId(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    requestId,
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logos).*)"],
};
