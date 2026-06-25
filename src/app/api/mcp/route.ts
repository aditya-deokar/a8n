/**
 * MCP Streamable HTTP API Route
 *
 * Next.js App Router API route that handles MCP protocol requests
 * over Streamable HTTP transport. This is the single entry point
 * for all MCP client connections.
 *
 * Endpoint: POST /api/mcp
 *
 * Authentication: Bearer token in Authorization header
 *   - API Key:    "Bearer a8n_mcp_..."
 *   - Session:    "Bearer <session-token>"
 *
 * Compatible with: Antigravity, Cursor, Claude Code, MCP Inspector
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp";
import { validateBearerToken } from "@/mcp/auth/bearer-auth.middleware";
import { checkRateLimit, rateLimitHeaders } from "@/mcp/middleware/rate-limiter";
import { createAuditContext, extractRequestMeta } from "@/mcp/middleware/audit-logger";
import { MCP_CONFIG } from "@/mcp/config";
import { getMcpAppProfile, type McpAppProfile } from "@/mcp/app-profile";
import { buildOAuthWwwAuthenticateHeader } from "@/mcp/auth/oauth.service";
import type { McpAuthInfo } from "@/mcp/auth/types";
import type { RateLimitResult } from "@/mcp/middleware/rate-limiter";

type AuthGuardSuccess = { auth: McpAuthInfo; rateResult: RateLimitResult };
type AuthGuardError = { error: Response };
type AuthGuardResult = AuthGuardSuccess | AuthGuardError;

const MCP_ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const MCP_ALLOWED_HEADERS =
  "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id";
const MCP_EXPOSED_HEADERS =
  "Mcp-Session-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After";

function configuredCorsOrigins(): string[] {
  return MCP_CONFIG.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  const allowedOrigins = configuredCorsOrigins();
  if (allowedOrigins.includes("*")) return true;

  return allowedOrigins.includes(origin);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowedOrigins = configuredCorsOrigins();
  const allowAnyOrigin = allowedOrigins.includes("*");
  const allowOrigin = origin && !allowAnyOrigin ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": MCP_ALLOWED_METHODS,
    "Access-Control-Allow-Headers": MCP_ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": MCP_EXPOSED_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appProfileFromRequest(request: Request): McpAppProfile {
  const url = new URL(request.url);
  return getMcpAppProfile(
    url.searchParams.get("profile") || url.searchParams.get("mcp_app_profile"),
  );
}

function rejectDisallowedOrigin(request: Request): Response | null {
  if (isOriginAllowed(request)) return null;

  return withCors(
    request,
    new Response(
      JSON.stringify({
        error: "Origin not allowed for MCP endpoint.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
}

/**
 * Shared authentication + rate limiting guard.
 * Returns the auth context and rate limit result, or an error Response.
 */
async function authenticateRequest(request: Request): Promise<AuthGuardResult> {
  // ─── 1. Authentication ──────────────────────────────────────
  const authResult = await validateBearerToken(request);

  if (!authResult.ok) {
    return {
      error: new Response(
        JSON.stringify({
          error: authResult.error,
          hint:
            "Connect your a8n account through OAuth, or provide a valid API key/session token in the Authorization header: Bearer <token>",
        }),
        {
          status: authResult.status,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": buildOAuthWwwAuthenticateHeader(request),
          },
        },
      ),
    };
  }

  // ─── 2. Rate Limiting ───────────────────────────────────────
  const rateLimitKey = authResult.auth.apiKeyId || authResult.auth.userId;
  const rateResult = checkRateLimit(rateLimitKey);

  if (!rateResult.allowed) {
    return {
      error: new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait before making more requests.",
          retryAfterSeconds: Math.ceil(rateResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(rateResult.resetMs / 1000)),
            ...rateLimitHeaders(rateResult),
          },
        },
      ),
    };
  }

  return { auth: authResult.auth, rateResult };
}

/**
 * Handle MCP POST requests (main protocol communication).
 *
 * Flow:
 *   1. Authenticate via Bearer token
 *   2. Check rate limits
 *   3. Create stateless Web Standard transport
 *   4. Connect MCP server
 *   5. Handle the protocol request
 */
export async function POST(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return withCors(request, guardResult.error);

  const { auth, rateResult } = guardResult;
  const { ip, userAgent } = extractRequestMeta(request);
  const appProfile = appProfileFromRequest(request);

  // ─── Audit Log ─────────────────────────────────────────────
  const audit = createAuditContext({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    authMethod: auth.method,
    tool: "mcp_request",
    input: { method: "POST", url: request.url },
    ip,
    userAgent,
  });

  try {
    // ─── Create Transport (stateless, Web Standard) ─────────
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    // ─── Create & Connect Server ────────────────────────────
    const server = createMcpServer(auth, { appProfile });
    await server.connect(transport);

    // ─── Handle Protocol Request ────────────────────────────
    const response = await transport.handleRequest(request);

    audit.success();

    // transport.handleRequest may return undefined for certain scenarios
    if (!response) {
      return new Response(null, { status: 204 });
    }

    // Inject rate limit headers into the transport response
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(rateLimitHeaders(rateResult))) {
      headers.set(key, value);
    }

    return withCors(
      request,
      new Response(response.body, {
        status: response.status,
        headers,
      }),
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    audit.fail(errorMessage);

    console.error("[MCP:ROUTE] Request handling failed:", error);

    return withCors(
      request,
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message:
              process.env.NODE_ENV === "development"
                ? errorMessage
                : "Internal server error",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
}

/**
 * Handle GET requests — SSE streams and server capability discovery.
 * Some MCP clients use GET for SSE-based streaming.
 */
export async function GET(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return withCors(request, guardResult.error);
  const { auth } = guardResult;
  const appProfile = appProfileFromRequest(request);

  // Create transport and pass through the GET for SSE stream support
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer(auth, { appProfile });
    await server.connect(transport);

    const response = await transport.handleRequest(request);
    return withCors(request, response ?? new Response(null, { status: 204 }));
  } catch {
    // Fallback: return server info as JSON
    return withCors(
      request,
      new Response(
        JSON.stringify({
          name: MCP_CONFIG.SERVER_NAME,
          version: MCP_CONFIG.SERVER_VERSION,
          description: MCP_CONFIG.SERVER_DESCRIPTION,
          endpoint: MCP_CONFIG.ENDPOINT_PATH,
          transport: "streamable-http",
          auth: "Bearer token (API key or session)",
          appProfile,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
}

/**
 * Handle DELETE requests — session cleanup (stateless = no-op).
 */
export async function DELETE(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return withCors(request, guardResult.error);
  const { auth } = guardResult;
  const appProfile = appProfileFromRequest(request);

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer(auth, { appProfile });
    await server.connect(transport);

    const response = await transport.handleRequest(request);
    return withCors(request, response ?? new Response(null, { status: 204 }));
  } catch {
    return withCors(request, new Response(null, { status: 204 }));
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  return withCors(request, new Response(null, { status: 204 }));
}
