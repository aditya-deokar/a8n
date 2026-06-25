import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpToolContext } from "@/mcp/shared/auth-context";
import {
  registerGenerateGoogleFormScript,
  registerGetIntegrationSetupGuide,
  registerGetWebhookUrl,
  registerGetWorkflowSetupChecklist,
  registerTestCredential,
  registerTestWebhookSetup,
} from "./integration-tools";

export function registerIntegrationTools(
  server: McpServer,
  context: McpToolContext = {},
) {
  registerGetWorkflowSetupChecklist(server, context);
  registerGetIntegrationSetupGuide(server, context);
  registerTestCredential(server, context);
  registerTestWebhookSetup(server, context);
  registerGenerateGoogleFormScript(server, context);
  registerGetWebhookUrl(server, context);
}
