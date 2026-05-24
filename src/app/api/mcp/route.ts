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
import type { McpAuthInfo } from "@/mcp/auth/types";
import type { RateLimitResult } from "@/mcp/middleware/rate-limiter";

type AuthGuardSuccess = { auth: McpAuthInfo; rateResult: RateLimitResult };
type AuthGuardError = { error: Response };
type AuthGuardResult = AuthGuardSuccess | AuthGuardError;

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
          hint: "Provide a valid API key or session token in the Authorization header: Bearer <token>",
        }),
        {
          status: authResult.status,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer realm="${MCP_CONFIG.SERVER_NAME}"`,
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
  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return guardResult.error;

  const { auth, rateResult } = guardResult;
  const { ip, userAgent } = extractRequestMeta(request);

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
    const server = createMcpServer();
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

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    audit.fail(errorMessage);

    console.error("[MCP:ROUTE] Request handling failed:", error);

    return new Response(
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
    );
  }
}

/**
 * Handle GET requests — SSE streams and server capability discovery.
 * Some MCP clients use GET for SSE-based streaming.
 */
export async function GET(request: Request): Promise<Response> {
  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return guardResult.error;

  // Create transport and pass through the GET for SSE stream support
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer();
    await server.connect(transport);

    const response = await transport.handleRequest(request);
    return response ?? new Response(null, { status: 204 });
  } catch {
    // Fallback: return server info as JSON
    return new Response(
      JSON.stringify({
        name: MCP_CONFIG.SERVER_NAME,
        version: MCP_CONFIG.SERVER_VERSION,
        description: MCP_CONFIG.SERVER_DESCRIPTION,
        endpoint: MCP_CONFIG.ENDPOINT_PATH,
        transport: "streamable-http",
        auth: "Bearer token (API key or session)",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle DELETE requests — session cleanup (stateless = no-op).
 */
export async function DELETE(request: Request): Promise<Response> {
  const guardResult = await authenticateRequest(request);
  if ("error" in guardResult) return guardResult.error;

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer();
    await server.connect(transport);

    const response = await transport.handleRequest(request);
    return response ?? new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
