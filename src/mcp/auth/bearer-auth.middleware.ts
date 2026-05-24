/**
 * Bearer Auth Middleware
 *
 * Validates the Authorization header on every MCP HTTP request.
 * Supports two authentication methods:
 *
 *   1. API Key:  "Bearer a8n_mcp_..." → hash-lookup in the api_key table
 *   2. Session:  "Bearer <session-token>" → validated via better-auth API
 *
 * Returns an McpAuthInfo context on success, or an error response on failure.
 */

import { auth } from "@/lib/auth";
import { MCP_CONFIG } from "../config";
import { validateApiKey } from "./api-key.service";
import type { AuthResult, McpAuthInfo } from "./types";
import type { McpScope } from "./scopes";
import { ALL_SCOPES } from "./scopes";

/**
 * Extract the bearer token from the Authorization header.
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

/**
 * Attempt authentication via API key (prefixed tokens).
 */
async function authenticateWithApiKey(
  token: string,
): Promise<AuthResult> {
  const apiKey = await validateApiKey(token);

  if (!apiKey) {
    return {
      ok: false,
      error: "Invalid or expired API key",
      status: 401,
    };
  }

  const authInfo: McpAuthInfo = {
    userId: apiKey.user.id,
    userName: apiKey.user.name,
    userEmail: apiKey.user.email,
    scopes: apiKey.scopes as McpScope[],
    apiKeyId: apiKey.id,
    method: "api_key",
  };

  return { ok: true, auth: authInfo };
}

/**
 * Attempt authentication via better-auth session token.
 * Session-authenticated users get full access (all scopes).
 */
async function authenticateWithSession(
  token: string,
  request: Request,
): Promise<AuthResult> {
  try {
    // Build headers that better-auth expects, injecting the token
    // as a cookie or Authorization header
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);

    const session = await auth.api.getSession({
      headers,
    });

    if (!session) {
      return {
        ok: false,
        error: "Invalid session token",
        status: 401,
      };
    }

    const authInfo: McpAuthInfo = {
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      scopes: ALL_SCOPES, // Session auth gets full access
      method: "session",
    };

    return { ok: true, auth: authInfo };
  } catch {
    return {
      ok: false,
      error: "Session validation failed",
      status: 401,
    };
  }
}

/**
 * Validate the bearer token from the incoming MCP request.
 *
 * Authentication flow:
 *   1. Extract Bearer token from Authorization header
 *   2. If token starts with "a8n_mcp_" → validate as API key
 *   3. Otherwise → validate as better-auth session token
 *   4. Return McpAuthInfo on success, error details on failure
 */
export async function validateBearerToken(
  request: Request,
): Promise<AuthResult> {
  const token = extractBearerToken(request);

  if (!token) {
    return {
      ok: false,
      error: "Missing Authorization header. Expected: Bearer <token>",
      status: 401,
    };
  }

  // Route to the appropriate authentication strategy
  if (token.startsWith(MCP_CONFIG.API_KEY_PREFIX)) {
    return authenticateWithApiKey(token);
  }

  return authenticateWithSession(token, request);
}
