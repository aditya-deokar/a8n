/**
 * API Key Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerCreateApiKey,
  registerListApiKeys,
  registerRevokeApiKey,
} from "./api-key-tools";

export function registerApiKeyTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerCreateApiKey(server, context);
  registerListApiKeys(server, context);
  registerRevokeApiKey(server, context);
}
