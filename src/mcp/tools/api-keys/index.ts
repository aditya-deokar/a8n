/**
 * API Key Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerCreateApiKey,
  registerListApiKeys,
  registerRevokeApiKey,
} from "./api-key-tools";

export function registerApiKeyTools(server: McpServer) {
  registerCreateApiKey(server);
  registerListApiKeys(server);
  registerRevokeApiKey(server);
}
