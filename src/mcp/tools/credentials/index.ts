/**
 * Credential Tools — Barrel Export
 *
 * Registers all 6 credential-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerListCredentials,
  registerGetCredential,
  registerCreateCredential,
  registerUpdateCredential,
  registerDeleteCredential,
  registerListCredentialsByType,
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
  registerListCredentialsByType(server, context);
}
