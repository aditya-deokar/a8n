/**
 * Scope Guard Middleware
 *
 * Enforces permission checks before each MCP tool execution.
 * Each tool declares its required scope; this guard verifies
 * the authenticated user has the necessary permission.
 */

import { hasScope, type McpScope } from "../auth/scopes";
import type { McpAuthInfo } from "../auth/types";

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
    throw new Error(
      `Permission denied: this operation requires the "${requiredScope}" scope. ` +
        `Your API key has scopes: [${auth.scopes.join(", ")}]. ` +
        `Create a new API key with the required scope or use a wildcard ("*") key.`,
    );
  }
}
