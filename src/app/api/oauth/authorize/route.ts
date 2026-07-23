import { auth } from "@/lib/auth";
import {
  issueAuthorizationCode,
  parseAuthorizeParams,
  recordOAuthConsent,
  scopeString,
  validateOAuthClient,
  type OAuthAuthorizeParams,
} from "@/mcp/auth/oauth.service";
import {
  clearOAuthCsrfCookie,
  createOAuthCsrfToken,
  oauthCsrfCookie,
  validateAndConsumeOAuthCsrf,
} from "@/mcp/auth/oauth-csrf";
import {
  checkOAuthRouteRateLimit,
  oauthRateLimitResponse,
} from "@/mcp/auth/oauth-route-guard";
import { createAuditContext, extractRequestMeta } from "@/mcp/middleware/audit-logger";
import { withRequestLogging } from "@/lib/logging";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function oauthErrorRedirect(
  redirectUri: string,
  error: string,
  description: string,
  state?: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}

function badRequest(message: string): Response {
  return new Response(
    `<!doctype html><html><body><h1>OAuth request error</h1><p>${escapeHtml(message)}</p></body></html>`,
    {
      status: 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function redirectToLogin(request: Request): Response {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("callbackURL", `${requestUrl.pathname}${requestUrl.search}`);
  return Response.redirect(loginUrl, 302);
}

async function currentSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

// Removed consentHtml generation as it is now handled by the /oauth/authorize React Server Component.

function auditConsentEvent(params: {
  request: Request;
  userId: string;
  event: "approved" | "denied" | "csrf_failed";
  oauth?: OAuthAuthorizeParams;
  error?: string;
}) {
  const meta = extractRequestMeta(params.request);
  const audit = createAuditContext({
    userId: params.userId,
    authMethod: "session",
    tool: `oauth.consent_${params.event}`,
    input: {
      clientId: params.oauth?.clientId,
      redirectUri: params.oauth?.redirectUri,
      resource: params.oauth?.resource,
      scopes: params.oauth?.scope,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (params.error) {
    audit.fail(params.error);
  } else {
    audit.success();
  }
}

function withClearedCsrf(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", clearOAuthCsrfCookie());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getHandler(request: Request): Promise<Response> {
  const rateResult = checkOAuthRouteRateLimit(request, "authorize");
  if (!rateResult.allowed) return oauthRateLimitResponse(rateResult);

  try {
    const url = new URL(request.url);
    const params = parseAuthorizeParams(url, request);
    await validateOAuthClient({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
    });

    const session = await currentSession(request);
    if (!session) return redirectToLogin(request);

    const csrfToken = createOAuthCsrfToken();
    
    // Redirect to the new React page, preserving all search params
    const redirectUrl = new URL("/oauth/authorize", request.url);
    url.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    return new Response(null, {
      status: 302,
      headers: {
        "Location": redirectUrl.toString(),
        "Set-Cookie": oauthCsrfCookie(csrfToken),
      },
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid OAuth authorization request.");
  }
}

async function postHandler(request: Request): Promise<Response> {
  const rateResult = checkOAuthRouteRateLimit(request, "authorize");
  if (!rateResult.allowed) return oauthRateLimitResponse(rateResult);

  const session = await currentSession(request);
  if (!session) return redirectToLogin(request);

  const form = await request.formData();
  if (!validateAndConsumeOAuthCsrf(request, form.get("csrf_token"))) {
    auditConsentEvent({
      request,
      userId: session.user.id,
      event: "csrf_failed",
      error: "OAuth consent CSRF token validation failed.",
    });
    return withClearedCsrf(badRequest("Invalid or expired OAuth consent token. Please restart account linking."));
  }

  const action = String(form.get("action") || "");
  const url = new URL(request.url);
  for (const key of [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
    "resource",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") url.searchParams.set(key, value);
  }

  try {
    const params = parseAuthorizeParams(url, request);
    await validateOAuthClient({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
    });

    if (action !== "approve") {
      auditConsentEvent({ request, userId: session.user.id, event: "denied", oauth: params });
      return withClearedCsrf(oauthErrorRedirect(
        params.redirectUri,
        "access_denied",
        "The user denied access to a8n.",
        params.state,
      ));
    }

    await recordOAuthConsent({
      userId: session.user.id,
      clientId: params.clientId,
      scopes: params.scope,
      redirectUri: params.redirectUri,
      resource: params.resource,
    });
    auditConsentEvent({ request, userId: session.user.id, event: "approved", oauth: params });

    const code = await issueAuthorizationCode({
      ...params,
      userId: session.user.id,
    });
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) redirectUrl.searchParams.set("state", params.state);

    return withClearedCsrf(Response.redirect(redirectUrl, 302));
  } catch (error) {
    return withClearedCsrf(badRequest(error instanceof Error ? error.message : "Invalid OAuth authorization request."));
  }
}

export const GET = withRequestLogging(getHandler, {
  component: "auth",
  route: "/api/oauth/authorize",
  eventPrefix: "oauth_authorize_request",
});

export const POST = withRequestLogging(postHandler, {
  component: "auth",
  route: "/api/oauth/authorize",
  eventPrefix: "oauth_authorize_request",
});
