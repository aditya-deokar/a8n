import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerGenerateGoogleFormScript,
  registerGetWorkflowSetupChecklist,
  registerTestCredential,
} from "./integration-tools";

export function registerIntegrationTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerGetWorkflowSetupChecklist(server, context);
  registerTestCredential(server, context);
  registerGenerateGoogleFormScript(server, context);
}
