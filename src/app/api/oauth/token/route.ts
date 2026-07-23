import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/mcp/auth/oauth.service";
import {
  checkOAuthRouteRateLimit,
  oauthRateLimitResponse,
} from "@/mcp/auth/oauth-route-guard";
import { withRequestLogging, logger } from "@/lib/logging";

export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
}

async function bodyParams(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (typeof value === "string") params.set(key, value);
    }
    return params;
  }

  return new URLSearchParams(await request.text());
}

function tokenError(
  error: string,
  description: string,
  status = 400,
): Response {
  return Response.json(
    {
      error,
      error_description: description,
    },
    { status, headers: corsHeaders() },
  );
}

async function postHandler(request: Request): Promise<Response> {
  const rateResult = checkOAuthRouteRateLimit(request, "token");
  if (!rateResult.allowed) return oauthRateLimitResponse(rateResult, corsHeaders());

  const params = await bodyParams(request);
  const grantType = params.get("grant_type");
  const clientId = params.get("client_id") || "";
  const resource = params.get("resource") || undefined;

  try {
    if (grantType === "authorization_code") {
      const code = params.get("code") || "";
      const redirectUri = params.get("redirect_uri") || "";
      const codeVerifier = params.get("code_verifier") || "";

      if (!clientId || !code || !redirectUri || !codeVerifier) {
        return tokenError(
          "invalid_request",
          "client_id, code, redirect_uri, and code_verifier are required.",
        );
      }

      const token = await exchangeAuthorizationCode({
        code,
        codeVerifier,
        clientId,
        redirectUri,
        resource,
      });

      return Response.json(token, { headers: corsHeaders() });
    }

    if (grantType === "refresh_token") {
      const refreshToken = params.get("refresh_token") || "";
      if (!clientId || !refreshToken) {
        return tokenError("invalid_request", "client_id and refresh_token are required.");
      }

      const token = await refreshAccessToken({
        refreshToken,
        clientId,
        resource,
      });

      return Response.json(token, { headers: corsHeaders() });
    }

    return tokenError(
      "unsupported_grant_type",
      "Supported grant types are authorization_code and refresh_token.",
    );
  } catch (error) {
    logger.error({
      event: "oauth_token_exchange_error",
      grantType,
      clientId,
      resource,
      error: error instanceof Error ? error.message : error,
    }, "[oauth/token] Token exchange error");
    return tokenError(
      "invalid_grant",
      error instanceof Error ? error.message : "Token exchange failed.",
    );
  }
}

async function optionsHandler(request: Request): Promise<Response> {
  void request;

  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export const POST = withRequestLogging(postHandler, {
  component: "auth",
  route: "/api/oauth/token",
  eventPrefix: "oauth_token_request",
});

export const OPTIONS = withRequestLogging(optionsHandler, {
  component: "auth",
  route: "/api/oauth/token",
  eventPrefix: "oauth_token_request",
});
