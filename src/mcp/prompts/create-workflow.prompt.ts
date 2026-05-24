/**
 * Prompt: create_workflow
 *
 * Guided template for building workflows step-by-step.
 * The LLM uses this prompt to walk users through the process.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCreateWorkflowPrompt(server: McpServer) {
  server.prompt(
    "create_workflow",
    "Step-by-step guide for building an a8n workflow. Provide a description of what you want the workflow to do.",
    {
      description: z
        .string()
        .describe("Describe what the workflow should do (e.g., 'When a Google Form is submitted, use OpenAI to summarize it and send it to Slack')"),
    },
    async (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I want to create an a8n workflow that does the following:

${args.description}

Please help me build this step-by-step using the available MCP tools. Here's the process:

1. **Understand the requirement** — Break down the description into individual steps/nodes
2. **Check available node types** — Use \`list_node_types\` to see what's available
3. **Set up credentials** — If AI nodes are needed, use \`list_credentials_by_type\` to check existing credentials or \`create_credential\` to add new ones
4. **Create the workflow** — Use \`create_workflow\` to initialize it
5. **Design the graph** — Use \`update_workflow\` to add all nodes with correct positions and connections
6. **Test it** — Use \`execute_workflow\` to run and \`get_execution\` to verify results

Node positioning guide:
- Place nodes left-to-right with ~300px horizontal spacing
- First node at (0, 0), second at (300, 0), third at (600, 0), etc.
- For parallel branches, offset vertically by ~200px

Please proceed with building this workflow.`,
          },
        },
      ],
    }),
  );
}
