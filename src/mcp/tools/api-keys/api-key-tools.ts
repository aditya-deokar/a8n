/**
 * API Key Management Tools — create_api_key, list_api_keys, revoke_api_key
 * Scope: api_keys:manage
 *
 * Self-serve API key management via MCP. Users can create scoped
 * keys, list their active keys, and revoke compromised keys.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse, mcpTextResponse } from "@/mcp/shared/sanitize";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/mcp/auth/api-key.service";
import { ALL_SCOPES, type McpScope } from "@/mcp/auth/scopes";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";

// ─── create_api_key ──────────────────────────────────────────

export function registerCreateApiKey(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "create_api_key",
    "Create a new MCP API key with scoped permissions. The raw key is returned ONLY ONCE — store it securely. Available scopes: workflows:read, workflows:write, workflows:execute, credentials:read, credentials:write, executions:read, system:read, api_keys:manage, * (wildcard).",
    {
      name: z.string().min(1).describe("A human-readable label for this key (e.g., 'cursor-dev', 'ci-pipeline')"),
      scopes: z
        .array(z.string())
        .optional()
        .describe("Permission scopes. Defaults to read-only scopes. Use '*' for full access."),
      expiresInDays: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .describe("Number of days until expiry. Omit for a non-expiring key."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "api_keys:manage");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "create_api_key",
        input: { name: args.name, scopes: args.scopes },
      });

      return withErrorBoundary("create_api_key", async () => {
        // Validate scopes
        const requestedScopes = (args.scopes || []) as McpScope[];
        if (requestedScopes.length > 0) {
          for (const scope of requestedScopes) {
            if (!ALL_SCOPES.includes(scope)) {
              throw new Error(
                `Invalid scope: "${scope}". Valid scopes: ${ALL_SCOPES.join(", ")}`,
              );
            }
          }
        }

        const expiresAt = args.expiresInDays
          ? new Date(Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000)
          : undefined;

        const result = await createApiKey({
          userId: auth.userId,
          name: args.name,
          scopes: requestedScopes.length > 0 ? requestedScopes : undefined,
          expiresAt,
        });

        audit.success();
        return mcpJsonResponse({
          message: "API key created successfully. Store the rawKey securely — it will NOT be shown again.",
          rawKey: result.rawKey,
          ...result.record,
        });
      });
    },
  );
}

// ─── list_api_keys ───────────────────────────────────────────

export function registerListApiKeys(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "list_api_keys",
    "List all active (non-revoked) API keys for your account. Keys are shown with masked prefixes only — the full key is never retrievable after creation.",
    {},
    async (_args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "api_keys:manage");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "list_api_keys", input: {},
      });

      return withErrorBoundary("list_api_keys", async () => {
        const keys = await listApiKeys(auth.userId);

        audit.success();
        return mcpJsonResponse({
          apiKeys: keys.map((k) => ({
            ...k,
            keyPreview: `${k.keyPrefix}...`,
          })),
          count: keys.length,
        });
      });
    },
  );
}

// ─── revoke_api_key ──────────────────────────────────────────

export function registerRevokeApiKey(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "revoke_api_key",
    "Revoke an API key by its ID. The key is immediately invalidated and cannot be used for further requests.",
    {
      keyId: z.string().describe("The API key ID to revoke (use list_api_keys to find IDs)"),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "api_keys:manage");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "revoke_api_key", input: args,
      });

      return withErrorBoundary("revoke_api_key", async () => {
        const revoked = await revokeApiKey({
          keyId: args.keyId,
          userId: auth.userId,
        });

        if (!revoked) {
          throw new Error(
            "API key not found, already revoked, or you don't have permission to revoke it.",
          );
        }

        audit.success();
        return mcpTextResponse(`API key ${args.keyId} has been revoked.`);
      });
    },
  );
}
