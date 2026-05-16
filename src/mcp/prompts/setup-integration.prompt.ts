/**
 * Prompt: setup_integration
 *
 * Guided template for setting up a new integration (e.g., Slack,
 * Discord, OpenAI) including credential creation and workflow wiring.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const INTEGRATION_GUIDES: Record<string, string> = {
  openai: `## OpenAI Integration Setup

1. **Create credential**: Use \`create_credential\` with type "OPENAI" and your OpenAI API key (starts with sk-)
2. **Add to workflow**: Create or update a workflow with an OPENAI node, setting:
   - \`model\`: e.g., "gpt-4o", "gpt-4o-mini"
   - \`prompt\`: The system/user prompt
   - \`temperature\`: 0.0-2.0 (default 0.7)
3. **Link credential**: Include the credentialId in the node's data
4. **Connect**: Wire a trigger node → OPENAI node`,

  anthropic: `## Anthropic Integration Setup

1. **Create credential**: Use \`create_credential\` with type "ANTHROPIC" and your API key (starts with sk-ant-)
2. **Add to workflow**: Create or update a workflow with an ANTHROPIC node, setting:
   - \`model\`: e.g., "claude-sonnet-4-20250514"
   - \`prompt\`: The prompt text
   - \`maxTokens\`: Maximum output tokens
3. **Link credential**: Include the credentialId in the node's data
4. **Connect**: Wire a trigger node → ANTHROPIC node`,

  gemini: `## Gemini Integration Setup

1. **Create credential**: Use \`create_credential\` with type "GEMINI" and your Google AI API key
2. **Add to workflow**: Create or update a workflow with a GEMINI node, setting:
   - \`model\`: e.g., "gemini-2.0-flash"
   - \`prompt\`: The prompt text
3. **Link credential**: Include the credentialId in the node's data
4. **Connect**: Wire a trigger node → GEMINI node`,

  slack: `## Slack Integration Setup

1. **Create a Slack Webhook URL**: Go to api.slack.com → Your App → Incoming Webhooks → Add
2. **Add to workflow**: Create or update a workflow with a SLACK node, setting:
   - \`webhookUrl\`: The Slack webhook URL
   - \`text\`: Message text (can use data from previous nodes)
   - \`channel\`: Optional channel override
3. **Connect**: Wire your source node → SLACK node`,

  discord: `## Discord Integration Setup

1. **Create a Discord Webhook URL**: Server Settings → Integrations → Webhooks → New Webhook
2. **Add to workflow**: Create or update a workflow with a DISCORD node, setting:
   - \`webhookUrl\`: The Discord webhook URL
   - \`content\`: Message content
3. **Connect**: Wire your source node → DISCORD node`,

  http: `## HTTP Request Integration Setup

1. **Add to workflow**: Create or update a workflow with an HTTP_REQUEST node, setting:
   - \`url\`: The target API URL
   - \`method\`: GET, POST, PUT, DELETE, PATCH
   - \`headers\`: Optional request headers (JSON object)
   - \`body\`: Optional request body (for POST/PUT/PATCH)
2. **Connect**: Wire your trigger → HTTP_REQUEST node
3. **No credential needed**: HTTP_REQUEST uses direct configuration`,
};

export function registerSetupIntegrationPrompt(server: McpServer) {
  server.prompt(
    "setup_integration",
    "Step-by-step guide for setting up a specific integration (OpenAI, Anthropic, Gemini, Slack, Discord, HTTP). Includes credential creation and workflow configuration.",
    {
      service: z
        .string()
        .describe("The service to integrate: openai, anthropic, gemini, slack, discord, or http"),
    },
    async (args) => {
      const serviceKey = args.service.toLowerCase().trim();
      const guide = INTEGRATION_GUIDES[serviceKey];

      const availableServices = Object.keys(INTEGRATION_GUIDES).join(", ");

      if (!guide) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to set up an integration with "${args.service}", but I don't have a specific guide for it.

Available integration guides: ${availableServices}

Please help me set this up by:
1. Checking available node types with \`list_node_types\`
2. Determining if a credential is needed
3. Walking me through the workflow creation process

If "${args.service}" isn't a supported node type, we can use the HTTP_REQUEST node to integrate with any REST API.`,
              },
            },
          ],
        };
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I want to set up a ${args.service} integration in my n8n workflow.

${guide}

## Let's do this step by step:

First, check if I already have the necessary credentials by using \`list_credentials_by_type\` (if applicable). Then walk me through each step, using the appropriate MCP tools for each action.

Available integration guides: ${availableServices}`,
            },
          },
        ],
      };
    },
  );
}
