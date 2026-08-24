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
import { checkRateLimitForRequest, rateLimitHeaders } from "@/mcp/middleware/rate-limiter";
import { createAuditContext, extractRequestMeta } from "@/mcp/middleware/audit-logger";
import { MCP_CONFIG } from "@/mcp/config";
import { getMcpAppProfile, type McpAppProfile } from "@/mcp/app-profile";
import { buildOAuthWwwAuthenticateHeader } from "@/mcp/auth/oauth.service";
import type { McpAuthInfo } from "@/mcp/auth/types";
import type { RateLimitResult } from "@/mcp/middleware/rate-limiter";
import { recordMcpRuntimeEvent } from "@/mcp/observability/runtime-guardrails";
import { getToolContract } from "@/mcp/contracts/tools.manifest";
import { isKillSwitchEnabled } from "@/lib/feature-flags";
import { logger, normalizeError, withRequestLogging } from "@/lib/logging";
import { getEffectivePlan } from "@/lib/entitlements/get-plan";

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
  const originAllowed = origin ? allowedOrigins.includes(origin) : false;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": MCP_ALLOWED_METHODS,
    "Access-Control-Allow-Headers": MCP_ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": MCP_EXPOSED_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (!origin || allowAnyOrigin) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (originAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
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
  if (
    process.env.NODE_ENV === "production" &&
    configuredCorsOrigins().includes("*")
  ) {
    return new Response(
      JSON.stringify({
        error: "MCP_CORS_ORIGINS must list explicit origins in production.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function jsonRpcId(value: unknown) {
  const record = asRecord(value);
  const id = record?.id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function mcpToolName(value: unknown) {
  const record = asRecord(value);
  if (record?.method !== "tools/call") return null;

  const params = asRecord(record.params);
  return typeof params?.name === "string" ? params.name : null;
}

function isMutatingMcpTool(toolName: string) {
  const contract = getToolContract(toolName);
  if (!contract) return false;

  return (
    contract.risk !== "read_only" ||
    contract.externalSideEffect ||
    contract.destructive ||
    contract.admin
  );
}

async function rejectMcpMutationWhenDisabled(
  request: Request,
  auth: McpAuthInfo,
): Promise<Response | null> {
  if (!isKillSwitchEnabled("disableMcpMutations")) return null;

  let payload: unknown;
  try {
    payload = await request.clone().json();
  } catch {
    return null;
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const blockedMessage = messages.find((message) => {
    const toolName = mcpToolName(message);
    return Boolean(toolName && isMutatingMcpTool(toolName));
  });
  const blockedToolName = blockedMessage ? mcpToolName(blockedMessage) : null;
  if (!blockedToolName) return null;
  const blockedContract = getToolContract(blockedToolName);

  recordMcpRuntimeEvent({
    type: "runtime_guardrail_denial",
    userId: auth.userId,
    authMethod: auth.method,
    oauthClientId: auth.oauthClientId,
    tool: blockedToolName,
    risk: blockedContract?.risk,
    profile: blockedContract?.profiles.includes("chatgpt") ? "chatgpt" : "default",
    status: "denied",
    error: `MCP mutation blocked by disableMcpMutations: ${blockedToolName}`,
  });

  return withCors(
    request,
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: jsonRpcId(blockedMessage),
        error: {
          code: -32000,
          message: "MCP mutations are temporarily disabled.",
        },
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
}

/**
 * Shared authentication + rate limiting guard.
 * Returns the auth context and rate limit result, or an error Response.
 */
async function resolveRateLimitTier(
  userId: string | undefined,
): Promise<"free" | "pro"> {
  if (!userId) return "free";
  try {
    return await getEffectivePlan(userId);
  } catch {
    // Rate limiting is a stability control: degrade to the stricter tier.
    return "free";
  }
}

async function authenticateRequest(request: Request): Promise<AuthGuardResult> {
  // ─── 1. Authentication ──────────────────────────────────────
  const authResult = await validateBearerToken(request);

  if (!authResult.ok) {
    recordMcpRuntimeEvent({
      type: "auth_failure",
      authMethod: "unknown",
      status: "error",
      error: authResult.error,
    });
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
  const tier = await resolveRateLimitTier(authResult.auth.userId);
  const rateResult = await checkRateLimitForRequest(rateLimitKey, tier);

  if (!rateResult.allowed) {
    recordMcpRuntimeEvent({
      type: "rate_limit_denial",
      userId: authResult.auth.userId,
      authMethod: authResult.auth.method,
      oauthClientId: authResult.auth.oauthClientId,
      status: "denied",
      error: "Rate limit exceeded.",
    });
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
async function postHandler(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return withCors(request, guardResult.error);

  const { auth, rateResult } = guardResult;
  const mutationError = await rejectMcpMutationWhenDisabled(request, auth);
  if (mutationError) return mutationError;

  const { ip, userAgent } = extractRequestMeta(request);
  const appProfile = appProfileFromRequest(request);

  // ─── Audit Log ─────────────────────────────────────────────
  const audit = createAuditContext({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    authMethod: auth.method,
    oauthClientId: auth.oauthClientId,
    profile: appProfile,
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

    logger.error(
      {
        component: "mcp",
        event: "mcp_route_failed",
        error: normalizeError(error),
      },
      "MCP request handling failed.",
    );

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
async function getHandler(request: Request): Promise<Response> {
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
async function deleteHandler(request: Request): Promise<Response> {
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

async function optionsHandler(request: Request): Promise<Response> {
  const originError = rejectDisallowedOrigin(request);
  if (originError) return originError;

  return withCors(request, new Response(null, { status: 204 }));
}

export const POST = withRequestLogging(postHandler, {
  component: "mcp",
  route: "/api/mcp",
  eventPrefix: "mcp_request",
});

export const GET = withRequestLogging(getHandler, {
  component: "mcp",
  route: "/api/mcp",
  eventPrefix: "mcp_request",
});

export const DELETE = withRequestLogging(deleteHandler, {
  component: "mcp",
  route: "/api/mcp",
  eventPrefix: "mcp_request",
});

export const OPTIONS = withRequestLogging(optionsHandler, {
  component: "mcp",
  route: "/api/mcp",
  eventPrefix: "mcp_request",
});
