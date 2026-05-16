/**
 * MCP Permission Scopes
 *
 * Fine-grained permission model for API key access control.
 * Each MCP tool declares its required scope; the scope guard
 * middleware validates the caller has the needed permission.
 */

export const MCP_SCOPES = {
  // Workflow scopes
  "workflows:read": "Read workflow data (list, get)",
  "workflows:write": "Create, update, rename, and delete workflows",
  "workflows:execute": "Trigger workflow executions",

  // Credential scopes
  "credentials:read": "Read credential metadata (names and types, not secret values)",
  "credentials:write": "Create, update, and delete credentials",

  // Execution scopes
  "executions:read": "Read execution history and results",

  // System scopes
  "system:read": "Read server info, node types, and user profile",

  // API key management
  "api_keys:manage": "Create, list, and revoke API keys",

  // Wildcard — full access
  "*": "Full access to all operations",
} as const;

/** A valid MCP permission scope */
export type McpScope = keyof typeof MCP_SCOPES;

/** All available scope keys */
export const ALL_SCOPES = Object.keys(MCP_SCOPES) as McpScope[];

/** Default scopes granted to new API keys when none are specified */
export const DEFAULT_SCOPES: McpScope[] = [
  "workflows:read",
  "credentials:read",
  "executions:read",
  "system:read",
];

/**
 * Check if a set of granted scopes satisfies a required scope.
 * The wildcard scope ("*") grants access to everything.
 */
export function hasScope(
  grantedScopes: McpScope[],
  requiredScope: McpScope,
): boolean {
  if (grantedScopes.includes("*")) return true;
  return grantedScopes.includes(requiredScope);
}
