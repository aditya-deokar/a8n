/**
 * Credential Tools — Barrel Export
 *
 * Registers all 5 credential-related MCP tools (Phase 1: list_credentials now
 * handles type filtering, so list_credentials_by_type was removed).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerListCredentials,
  registerGetCredential,
  registerCreateCredential,
  registerUpdateCredential,
  registerDeleteCredential,
} from "./credential-tools";

export function registerCredentialTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerListCredentials(server, context);
  registerGetCredential(server, context);
  registerCreateCredential(server, context);
  registerUpdateCredential(server, context);
  registerDeleteCredential(server, context);
}
