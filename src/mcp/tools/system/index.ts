/**
 * System Tools — Barrel Export
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import { registerWhoami, registerServerInfo, registerHealthCheck } from "./system-tools";
import { registerListMcpAuditEvents, registerSecurityStatus } from "./security-tools";

export function registerSystemTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerWhoami(server, context);
  registerServerInfo(server, context);
  registerHealthCheck(server, context);
  registerSecurityStatus(server, context);
  registerListMcpAuditEvents(server, context);
}
