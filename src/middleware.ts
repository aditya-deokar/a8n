import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionToken = 
    request.cookies.get("better-auth.session_token")?.value || 
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const pathname = request.nextUrl.pathname;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  
  // Dashboard routes that need protection
  const isDashboardPage = ['/workflows', '/executions', '/credentials', '/mcp'].some(path => pathname.startsWith(path));

  // Redirect unauthenticated users from protected routes to login
  if (isDashboardPage && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users from auth pages to the app dashboard
  if (isAuthPage && sessionToken) {
    return NextResponse.redirect(new URL("/workflows", request.url));
  }
  
  // Redirect authenticated users from the landing page to the app dashboard
  if (pathname === '/' && sessionToken) {
    return NextResponse.redirect(new URL("/workflows", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logos).*)'],
};
