export type McpToolRisk =
  | "read_only"
  | "draft_write"
  | "approval_gated_write"
  | "external_side_effect"
  | "repair_write"
  | "admin_or_destructive";

export type McpToolPolicy = {
  risk: McpToolRisk;
  requiresApproval: boolean;
  chatGptMvp: boolean;
  note: string;
};

export const CHATGPT_APP_TOOL_POLICY = {
  whoami: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads the connected a8n user profile and scopes.",
  },
  server_info: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads server metadata and capability counts.",
  },
  health_check: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Checks auth, database, and MCP server health.",
  },
  list_node_types: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Lists supported workflow node types.",
  },
  search_capabilities: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Searches node, credential, integration, and template catalogs.",
  },
  list_workflows: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Lists workflow metadata only.",
  },
  get_workflow: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads a workflow graph owned by the user.",
  },
  explain_workflow: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Explains a saved workflow or draft.",
  },
  plan_workflow_from_goal: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Plans a workflow without mutating stored data.",
  },
  create_workflow_draft: {
    risk: "draft_write",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Creates an unapplied draft, not a live workflow.",
  },
  answer_workflow_draft_questions: {
    risk: "draft_write",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Updates non-sensitive draft fields and refuses secret-looking answers.",
  },
  validate_workflow_draft: {
    risk: "draft_write",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Refreshes validation state on a draft.",
  },
  preview_workflow_diff: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Computes diff and confirmation hash before applying changes.",
  },
  apply_workflow_draft: {
    risk: "approval_gated_write",
    requiresApproval: true,
    chatGptMvp: true,
    note: "Requires approved=true and a matching confirmation hash.",
  },
  get_workflow_setup_checklist: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads setup gaps, credential metadata, webhook steps, and tests.",
  },
  get_integration_setup_guide: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads integration setup documentation.",
  },
  test_credential: {
    risk: "external_side_effect",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Dry-run by default; live mode may contact a provider.",
  },
  test_webhook_setup: {
    risk: "external_side_effect",
    requiresApproval: true,
    chatGptMvp: true,
    note: "Requires approved=true before triggering a sample workflow run.",
  },
  execute_workflow_and_wait: {
    risk: "external_side_effect",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Executes a real workflow and may produce external side effects.",
  },
  run_workflow_test: {
    risk: "external_side_effect",
    requiresApproval: true,
    chatGptMvp: true,
    note: "Requires approved=true before running sample data.",
  },
  get_execution_timeline: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Reads execution status, visible config, and summarized output.",
  },
  diagnose_execution: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Classifies execution failures without mutating data.",
  },
  suggest_workflow_fix: {
    risk: "repair_write",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Creates a repair draft without changing the live workflow.",
  },
  apply_workflow_fix: {
    risk: "approval_gated_write",
    requiresApproval: true,
    chatGptMvp: true,
    note: "Requires approved=true and a matching confirmation hash.",
  },
  render_workflow_draft_preview: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Renders a sanitized workflow draft preview widget.",
  },
  render_workflow_setup_checklist: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Renders a sanitized setup checklist widget.",
  },
  render_execution_timeline: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Renders a sanitized execution timeline widget.",
  },
  render_workflow_approval: {
    risk: "read_only",
    requiresApproval: false,
    chatGptMvp: true,
    note: "Renders the approval data required before applying a draft.",
  },
} satisfies Record<string, McpToolPolicy>;

export const CHATGPT_APP_TOOL_COUNT = Object.keys(CHATGPT_APP_TOOL_POLICY).length;

export const CHATGPT_FORBIDDEN_TOOLS = [
  "create_api_key",
  "list_api_keys",
  "revoke_api_key",
  "create_credential",
  "update_credential",
  "delete_credential",
  "delete_workflow",
  "update_workflow",
  "security_status",
  "list_mcp_audit_events",
] as const;

export function getChatGptToolPolicy(toolName: string): McpToolPolicy | null {
  return CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY] || null;
}

export function isForbiddenInChatGptProfile(toolName: string): boolean {
  return CHATGPT_FORBIDDEN_TOOLS.includes(toolName as (typeof CHATGPT_FORBIDDEN_TOOLS)[number]);
}
