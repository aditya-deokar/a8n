/**
 * Prompt: debug_execution
 *
 * Guided template for diagnosing failed workflow executions.
 * Helps the LLM systematically investigate execution failures.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDebugExecutionPrompt(server: McpServer) {
  server.prompt(
    "debug_execution",
    "Diagnose a failed workflow execution by systematically analyzing the execution details, workflow structure, and error messages.",
    {
      executionId: z
        .string()
        .describe("The execution ID to debug (get this from list_executions)"),
    },
    async (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I have a failed workflow execution that I need help debugging.

Execution ID: ${args.executionId}

Please diagnose this systematically:

1. **Get execution details** — Use \`get_execution\` with ID "${args.executionId}" to see the status, error message, error stack, and output
2. **Get the workflow** — Use the workflowId from the execution to call \`get_workflow\` and examine the node configuration
3. **Analyze the error** — Common failure patterns:
   - **Credential issues**: Missing or invalid API keys → check with \`list_credentials_by_type\`
   - **Node configuration**: Missing required fields in node data
   - **Connection errors**: HTTP request failures, webhook issues
   - **Cycle detection**: Workflow graph contains circular dependencies
   - **Execution timeout**: Long-running operations that exceeded limits
4. **Suggest fixes** — Based on the diagnosis, suggest specific changes using the appropriate MCP tools
5. **Re-execute** — After fixes, offer to re-run with \`execute_workflow\`

Please start by fetching the execution details.`,
          },
        },
      ],
    }),
  );
}
