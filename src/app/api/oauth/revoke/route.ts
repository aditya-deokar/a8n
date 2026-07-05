import { revokeOAuthToken } from "@/mcp/auth/oauth.service";
import {
  checkOAuthRouteRateLimit,
  oauthRateLimitResponse,
} from "@/mcp/auth/oauth-route-guard";
import { withRequestLogging } from "@/lib/logging";

export const dynamic = "force-dynamic";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

async function postHandler(request: Request): Promise<Response> {
  const rateResult = checkOAuthRouteRateLimit(request, "revoke");
  if (!rateResult.allowed) return oauthRateLimitResponse(rateResult, corsHeaders());

  const params = new URLSearchParams(await request.text());
  const token = params.get("token");
  if (token) {
    await revokeOAuthToken(token);
  }

  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
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
  route: "/api/oauth/revoke",
  eventPrefix: "oauth_revoke_request",
});

export const OPTIONS = withRequestLogging(optionsHandler, {
  component: "auth",
  route: "/api/oauth/revoke",
  eventPrefix: "oauth_revoke_request",
});
