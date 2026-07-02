import type { McpPromptContract } from "./types";

export const MCP_PROMPT_CONTRACTS: McpPromptContract[] = [
  {
    name: "create_workflow",
    source: "src/mcp/prompts/create-workflow.prompt.ts",
    requiredTools: [
      "plan_workflow_from_goal",
      "search_capabilities",
      "create_workflow_draft",
      "answer_workflow_draft_questions",
      "validate_workflow_draft",
      "preview_workflow_diff",
      "apply_workflow_draft",
    ],
    requiredResources: ["a8n://catalog/nodes"],
    asksForSecretsInChat: false,
    handlesUntrustedContent: true,
    note: "Guides safe workflow creation through draft, validation, preview, and approval.",
  },
  {
    name: "debug_execution",
    source: "src/mcp/prompts/debug-execution.prompt.ts",
    requiredTools: [
      "get_execution",
      "get_execution_timeline",
      "diagnose_execution",
      "suggest_workflow_fix",
      "apply_workflow_fix",
    ],
    requiredResources: [],
    asksForSecretsInChat: false,
    handlesUntrustedContent: true,
    note: "Guides execution debugging while treating execution output as data.",
  },
  {
    name: "setup_integration",
    source: "src/mcp/prompts/setup-integration.prompt.ts",
    requiredTools: [
      "get_integration_setup_guide",
      "get_workflow_setup_checklist",
      "test_credential",
      "test_webhook_setup",
    ],
    requiredResources: ["a8n://integrations/{service}/setup"],
    asksForSecretsInChat: false,
    handlesUntrustedContent: true,
    note: "Guides integration setup without asking for secrets in chat.",
  },
];
