/**
 * Scope Guard Middleware
 *
 * Enforces permission checks before each MCP tool execution.
 * Each tool declares its required scope; this guard verifies
 * the authenticated user has the necessary permission.
 */

import { hasScope, type McpScope } from "../auth/scopes";
import type { McpAuthInfo } from "../auth/types";
import { recordMcpRuntimeEvent } from "@/mcp/observability/runtime-guardrails";

/**
 * Check if the authenticated user has the required scope.
 * Throws a descriptive error if the scope is missing.
 *
 * @param auth - The authenticated user context
 * @param requiredScope - The scope required by the tool
 * @throws Error with scope violation message
 */
export function requireScope(
  auth: McpAuthInfo,
  requiredScope: McpScope,
): void {
  if (!hasScope(auth.scopes, requiredScope)) {
    recordMcpRuntimeEvent({
      type: "scope_denial",
      userId: auth.userId,
      authMethod: auth.method,
      oauthClientId: auth.oauthClientId,
      status: "denied",
      error: `Missing scope: ${requiredScope}`,
    });
    throw new Error(
      `Permission denied: this operation requires the "${requiredScope}" scope. ` +
        `Your connection has scopes: [${auth.scopes.join(", ")}]. ` +
        "Reconnect with the required scope or use a credential with broader access.",
    );
  }
}
