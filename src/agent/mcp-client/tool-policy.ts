import type { DynamicStructuredTool } from "@langchain/core/tools";
import {
  getToolContract,
  MCP_TOOL_CONTRACTS,
} from "@/mcp/contracts/tools.manifest";
import type { McpToolRisk } from "@/mcp/contracts/types";
import { AgentError } from "@/agent/errors";

export const EMBEDDED_AGENT_TOOL_NAMES = new Set([
  "whoami",
  "server_info",
  "health_check",
  "list_workflows",
  "get_workflow",
  "list_workflow_versions",
  "list_node_types",
  "search_capabilities",
  "list_credentials",
  "get_credential",
  "list_executions",
  "get_execution",
  "get_execution_timeline",
  "diagnose_execution",
  "suggest_workflow_fix",
  "get_workflow_setup_checklist",
  "generate_google_form_script",
  "plan_workflow_from_goal",
  "explain_workflow",
  "create_workflow_draft",
  "answer_workflow_draft_questions",
  "validate_workflow_draft",
  "preview_workflow_diff",
  "apply_workflow_draft",
]);

export const READ_ONLY_AGENT_RISKS = new Set<McpToolRisk>(["read_only"]);
export const DRAFT_WRITE_AGENT_RISKS = new Set<McpToolRisk>(["read_only", "draft_write"]);
export const APPLY_AGENT_RISKS = new Set<McpToolRisk>(["read_only", "draft_write", "approval_gated_write"]);

export function assertEmbeddedAgentToolAllowed(
  toolName: string,
  options: { allowDraftWrites?: boolean; allowApply?: boolean } = {},
): void {
  if (!EMBEDDED_AGENT_TOOL_NAMES.has(toolName)) {
    throw new AgentError(
      "AGENT_TOOL_NOT_ALLOWED",
      `Tool ${toolName} is not available to the embedded agent.`,
    );
  }

  const contract = getToolContract(toolName);
  if (!contract || !contract.profiles.includes("embedded_agent")) {
    throw new AgentError(
      "AGENT_TOOL_NOT_ALLOWED",
      `Tool ${toolName} has no embedded-agent contract.`,
    );
  }

  const allowedRisks = options.allowApply
    ? APPLY_AGENT_RISKS
    : options.allowDraftWrites
      ? DRAFT_WRITE_AGENT_RISKS
      : READ_ONLY_AGENT_RISKS;

  if (!allowedRisks.has(contract.risk)) {
    throw new AgentError(
      "AGENT_TOOL_NOT_ALLOWED",
      `Tool ${toolName} is disabled in the current agent mode.`,
    );
  }
}

export function embeddedAgentContracts() {
  return MCP_TOOL_CONTRACTS.filter((tool) =>
    EMBEDDED_AGENT_TOOL_NAMES.has(tool.name) &&
    tool.profiles.includes("embedded_agent"),
  );
}

export function assertEmbeddedAgentToolSet(
  tools: Array<Pick<DynamicStructuredTool, "name">>,
  options: { allowDraftWrites?: boolean; allowApply?: boolean } = {},
): void {
  for (const tool of tools) {
    assertEmbeddedAgentToolAllowed(tool.name, options);
  }
}
