import {
  checkRateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from "@/mcp/middleware/rate-limiter";

function routeIdentifier(request: Request, routeName: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `oauth:${routeName}:${ip}`;
}

export function checkOAuthRouteRateLimit(
  request: Request,
  routeName: string,
): RateLimitResult {
  return checkRateLimit(routeIdentifier(request, routeName));
}

export function oauthRateLimitResponse(
  result: RateLimitResult,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    {
      error: "rate_limited",
      error_description: "Too many OAuth requests. Try again after the reset window.",
    },
    {
      status: 429,
      headers: {
        ...headers,
        ...rateLimitHeaders(result),
        "Retry-After": String(Math.ceil(result.resetMs / 1000)),
      },
    },
  );
}
