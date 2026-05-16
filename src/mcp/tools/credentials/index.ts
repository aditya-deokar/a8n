/**
 * Credential Tools — Barrel Export
 *
 * Registers all 6 credential-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerListCredentials,
  registerGetCredential,
  registerCreateCredential,
  registerUpdateCredential,
  registerDeleteCredential,
  registerListCredentialsByType,
} from "./credential-tools";

export function registerCredentialTools(server: McpServer) {
  registerListCredentials(server);
  registerGetCredential(server);
  registerCreateCredential(server);
  registerUpdateCredential(server);
  registerDeleteCredential(server);
  registerListCredentialsByType(server);
}
