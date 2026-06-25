/**
 * Prompt: create_workflow
 *
 * Guided template for building workflows step by step.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCreateWorkflowPrompt(server: McpServer) {
  server.prompt(
    "create_workflow",
    "Step-by-step guide for building an a8n workflow from a plain-language description.",
    {
      description: z
        .string()
        .describe(
          "Describe what the workflow should do, for example: 'When a Google Form is submitted, summarize it with Gemini and email the respondent'.",
        ),
    },
    async (args) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to create an a8n workflow that does the following:

${args.description}

Please help me build this step by step using the available MCP tools.

Process:

1. Understand the requirement and restate it in simple language.
2. Use \`plan_workflow_from_goal\` and \`search_capabilities\` to map the goal to supported nodes, credentials, templates, and integrations.
3. Read \`a8n://catalog/nodes\` or call \`list_node_types\` for exact node fields and outputs.
4. Create a safe draft with \`create_workflow_draft\`.
5. Check credentials with \`list_credentials_by_type\` when credential-backed nodes are needed.
6. Fill only non-sensitive missing fields with \`answer_workflow_draft_questions\`. Do not ask for passwords, API keys, raw credential values, or webhook secrets in normal chat.
7. Run \`validate_workflow_draft\`.
8. Use \`explain_workflow\` and \`preview_workflow_diff\` to show the user the plain-language plan, setup checklist, side effects, and approval hash.
9. Apply only after explicit user approval by calling \`apply_workflow_draft\` with \`approved: true\` and the matching \`confirmationHash\`.
10. Test with \`execute_workflow\` and verify with \`list_executions\` or \`get_execution\`.

Use raw \`create_workflow\` and \`update_workflow\` only for advanced developer workflows. For non-technical users, prefer drafts, validation, explanation, preview, and approval before saving.`,
          },
        },
      ],
    }),
  );
}
