/**
 * Prompt: setup_integration
 *
 * Guided template for setting up a supported integration.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getIntegrationSetupGuide,
  INTEGRATION_SERVICE_KEYS,
  type IntegrationServiceKey,
} from "@/features/workflows/node-manifest";

function isIntegrationServiceKey(value: string): value is IntegrationServiceKey {
  return (INTEGRATION_SERVICE_KEYS as readonly string[]).includes(value);
}

export function registerSetupIntegrationPrompt(server: McpServer) {
  server.prompt(
    "setup_integration",
    "Step-by-step guide for setting up a specific integration: OpenAI, Anthropic, Gemini, Slack, Discord, HTTP, Email, Google Sheets, Google Forms, or Stripe.",
    {
      service: z
        .string()
        .describe(
          "The service to integrate: openai, anthropic, gemini, slack, discord, http, email, google_sheets, google_form, or stripe",
        ),
    },
    async (args) => {
      const serviceKey = args.service.toLowerCase().trim();
      const availableServices = INTEGRATION_SERVICE_KEYS.join(", ");

      if (!isIntegrationServiceKey(serviceKey)) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `I want to set up an integration with "${args.service}", but there is no specific setup guide for it.

Available integration guides: ${availableServices}

Please help me set this up by:
1. Calling \`search_capabilities\` for "${args.service}"
2. Checking available node types with \`list_node_types\`
3. Determining if a credential is needed
4. Walking me through the safest workflow creation process

If "${args.service}" is not a supported node type, use HTTP_REQUEST when the service has a REST API.`,
              },
            },
          ],
        };
      }

      const guide = getIntegrationSetupGuide(serviceKey);

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I want to set up a ${args.service} integration in my a8n workflow.

${guide}

Let's do this step by step:

1. Use \`search_capabilities\` to confirm the best node and credential type.
2. Check whether I already have any necessary credentials with \`list_credentials_by_type\`.
3. Explain what information is still missing in beginner-friendly language.
4. Create or update the workflow only after confirming the plan with me.

Available integration guides: ${availableServices}`,
            },
          },
        ],
      };
    },
  );
}
