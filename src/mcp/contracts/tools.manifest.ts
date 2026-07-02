import type { McpScope } from "@/mcp/auth/scopes";
import type {
  McpToolContract,
  McpToolDomain,
  McpToolProfile,
  McpToolRisk,
} from "./types";
import type { McpContractOutputSchemaName } from "./schemas";

const chatgptProfiles: McpToolProfile[] = ["default", "chatgpt"];
const defaultOnly: McpToolProfile[] = ["default"];
const chatgptOnly: McpToolProfile[] = ["chatgpt"];

function c(params: {
  name: string;
  domain: McpToolDomain;
  source: string;
  profiles?: McpToolProfile[];
  requiredScopes: McpScope[];
  risk: McpToolRisk;
  outputSchema: McpContractOutputSchemaName;
  note: string;
  requiresApproval?: boolean;
  externalSideEffect?: boolean;
  destructive?: boolean;
  admin?: boolean;
  forbiddenInChatGpt?: boolean;
  nativeOutputSchema?: boolean;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  exampleInput?: Record<string, unknown>;
}): McpToolContract {
  return {
    profiles: defaultOnly,
    requiresApproval: false,
    externalSideEffect: false,
    destructive: false,
    admin: false,
    forbiddenInChatGpt: false,
    nativeOutputSchema: false,
    annotations: {
      readOnlyHint: params.readOnlyHint ?? params.risk === "read_only",
      destructiveHint: params.destructiveHint ?? params.destructive,
      idempotentHint: params.idempotentHint,
      openWorldHint: params.openWorldHint,
    },
    exampleInput: {},
    ...params,
  };
}

export const MCP_TOOL_CONTRACTS: McpToolContract[] = [
  c({ name: "create_api_key", domain: "api_keys", source: "src/mcp/tools/api-keys/api-key-tools.ts", requiredScopes: ["api_keys:manage"], risk: "admin_or_destructive", outputSchema: "apiKeyCreated", note: "Creates a scoped MCP API key and returns the raw key once.", admin: true, forbiddenInChatGpt: true, exampleInput: { name: "CI key", scopes: ["workflows:read"] } }),
  c({ name: "list_api_keys", domain: "api_keys", source: "src/mcp/tools/api-keys/api-key-tools.ts", requiredScopes: ["api_keys:manage"], risk: "admin_or_destructive", outputSchema: "apiKeyList", note: "Lists API key metadata for the authenticated user.", admin: true, forbiddenInChatGpt: true }),
  c({ name: "revoke_api_key", domain: "api_keys", source: "src/mcp/tools/api-keys/api-key-tools.ts", requiredScopes: ["api_keys:manage"], risk: "admin_or_destructive", outputSchema: "textMessage", note: "Revokes an MCP API key after approval and confirmation hash.", requiresApproval: true, admin: true, destructive: true, forbiddenInChatGpt: true, exampleInput: { keyId: "api-key-id", approved: true, confirmationHash: "hash" } }),

  c({ name: "list_credentials", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:read"], risk: "read_only", outputSchema: "credentialList", note: "Lists credential metadata only.", exampleInput: { page: 1, pageSize: 10, search: "" } }),
  c({ name: "get_credential", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:read"], risk: "read_only", outputSchema: "credentialMetadata", note: "Reads credential metadata only.", exampleInput: { id: "credential-id" } }),
  c({ name: "create_credential", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:write"], risk: "admin_or_destructive", outputSchema: "credentialMetadata", note: "Creates encrypted credential from explicit secret input.", forbiddenInChatGpt: true, exampleInput: { name: "OpenAI", type: "OPENAI", value: "secret" } }),
  c({ name: "update_credential", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:write"], risk: "admin_or_destructive", outputSchema: "credentialMetadata", note: "Updates credential metadata and encrypted value.", forbiddenInChatGpt: true, exampleInput: { id: "credential-id", name: "OpenAI", type: "OPENAI", value: "secret" } }),
  c({ name: "delete_credential", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:write"], risk: "admin_or_destructive", outputSchema: "textMessage", note: "Deletes a credential after approval and confirmation hash.", requiresApproval: true, destructive: true, forbiddenInChatGpt: true, exampleInput: { id: "credential-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "list_credentials_by_type", domain: "credentials", source: "src/mcp/tools/credentials/credential-tools.ts", requiredScopes: ["credentials:read"], risk: "read_only", outputSchema: "credentialList", note: "Lists credential metadata filtered by type.", exampleInput: { type: "OPENAI" } }),

  c({ name: "list_executions", domain: "executions", source: "src/mcp/tools/executions/execution-tools.ts", requiredScopes: ["executions:read"], risk: "read_only", outputSchema: "executionList", note: "Lists workflow executions.", exampleInput: { page: 1, pageSize: 10 } }),
  c({ name: "get_execution", domain: "executions", source: "src/mcp/tools/executions/execution-tools.ts", requiredScopes: ["executions:read"], risk: "read_only", outputSchema: "executionDetail", note: "Reads one execution detail.", exampleInput: { id: "execution-id" } }),
  c({ name: "execute_workflow_and_wait", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:execute", "executions:read"], risk: "external_side_effect", outputSchema: "executionDetail", note: "Executes a real workflow and waits for completion after explicit approval.", requiresApproval: true, externalSideEffect: true, openWorldHint: true, exampleInput: { workflowId: "workflow-id", approved: true } }),
  c({ name: "run_workflow_test", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:execute"], risk: "external_side_effect", outputSchema: "executionDetail", note: "Runs a test workflow after approval.", requiresApproval: true, externalSideEffect: true, exampleInput: { workflowId: "workflow-id", trigger: "manual", approved: true } }),
  c({ name: "get_execution_timeline", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["executions:read"], risk: "read_only", outputSchema: "executionTimeline", note: "Reads sanitized node-by-node execution timeline.", exampleInput: { executionId: "execution-id" } }),
  c({ name: "diagnose_execution", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["executions:read"], risk: "read_only", outputSchema: "executionDiagnosis", note: "Classifies execution failure and suggests next actions.", exampleInput: { executionId: "execution-id" } }),
  c({ name: "suggest_workflow_fix", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write", "executions:read"], risk: "repair_write", outputSchema: "workflowDraft", note: "Creates a repair draft without mutating live workflow.", exampleInput: { executionId: "execution-id" } }),
  c({ name: "apply_workflow_fix", domain: "executions", source: "src/mcp/tools/executions/execution-runtime-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Applies repair draft after approval and confirmation hash.", requiresApproval: true, exampleInput: { draftId: "draft-id", approved: true, confirmationHash: "hash" } }),

  c({ name: "get_workflow_setup_checklist", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "setupChecklist", note: "Reads setup gaps, credentials, webhook steps, tests, and validation.", exampleInput: { workflowId: "workflow-id" } }),
  c({ name: "get_integration_setup_guide", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "integrationGuide", note: "Reads integration setup documentation.", exampleInput: { service: "openai" } }),
  c({ name: "get_webhook_url", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "webhookInfo", note: "Returns Google Form or Stripe webhook URL.", exampleInput: { workflowId: "workflow-id", trigger: "google_form" } }),
  c({ name: "generate_google_form_script", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "webhookInfo", note: "Generates Google Apps Script for form webhook setup.", exampleInput: { workflowId: "workflow-id" } }),
  c({ name: "test_webhook_setup", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:execute"], risk: "external_side_effect", outputSchema: "executionDetail", note: "Generates sample webhook payload and triggers test run only after approval.", requiresApproval: true, externalSideEffect: true, exampleInput: { workflowId: "workflow-id", trigger: "google_form", approved: true } }),
  c({ name: "test_credential", domain: "integrations", source: "src/mcp/tools/integrations/integration-tools.ts", profiles: chatgptProfiles, requiredScopes: ["credentials:read"], risk: "external_side_effect", outputSchema: "credentialTest", note: "Dry-run validates credential shape; live mode contacts providers only after approval.", requiresApproval: true, externalSideEffect: true, openWorldHint: true, exampleInput: { credentialId: "credential-id", live: true, approved: true } }),

  c({ name: "list_node_types", domain: "nodes", source: "src/mcp/tools/nodes/node-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "nodeCatalog", note: "Lists supported workflow node types.", nativeOutputSchema: true }),
  c({ name: "search_capabilities", domain: "nodes", source: "src/mcp/tools/nodes/node-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "nodeCatalog", note: "Searches node, credential, integration, and template catalogs.", nativeOutputSchema: true, exampleInput: { query: "slack" } }),

  c({ name: "whoami", domain: "system", source: "src/mcp/tools/system/system-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "systemInfo", note: "Reads connected user profile and scopes." }),
  c({ name: "server_info", domain: "system", source: "src/mcp/tools/system/system-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "systemInfo", note: "Reads MCP server metadata and capability counts." }),
  c({ name: "health_check", domain: "system", source: "src/mcp/tools/system/system-tools.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "systemInfo", note: "Checks server, auth, and database health." }),
  c({ name: "security_status", domain: "system", source: "src/mcp/tools/system/security-tools.ts", requiredScopes: ["system:read"], risk: "admin_or_destructive", outputSchema: "securityStatus", note: "Reads MCP security posture for operators.", admin: true, forbiddenInChatGpt: true }),
  c({ name: "list_mcp_audit_events", domain: "system", source: "src/mcp/tools/system/security-tools.ts", requiredScopes: ["system:read"], risk: "admin_or_destructive", outputSchema: "genericObject", note: "Lists persisted MCP audit events.", admin: true, forbiddenInChatGpt: true, exampleInput: { limit: 20 } }),

  c({ name: "create_workflow", domain: "workflows", source: "src/mcp/tools/workflows/create-workflow.tool.ts", requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowMutation", note: "Creates a saved workflow shell.", exampleInput: { name: "New workflow" } }),
  c({ name: "get_workflow", domain: "workflows", source: "src/mcp/tools/workflows/get-workflow.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "workflowGraph", note: "Reads a workflow graph owned by the user.", exampleInput: { id: "workflow-id" } }),
  c({ name: "list_workflows", domain: "workflows", source: "src/mcp/tools/workflows/list-workflows.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "workflowList", note: "Lists workflow metadata.", exampleInput: { page: 1, pageSize: 5, search: "" } }),
  c({ name: "update_workflow", domain: "workflows", source: "src/mcp/tools/workflows/update-workflow.tool.ts", requiredScopes: ["workflows:write"], risk: "admin_or_destructive", outputSchema: "workflowMutation", note: "Replaces broad workflow fields; excluded from ChatGPT profile.", forbiddenInChatGpt: true, exampleInput: { id: "workflow-id", name: "Updated" } }),
  c({ name: "plan_workflow_from_goal", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["system:read"], risk: "read_only", outputSchema: "workflowDraft", note: "Plans workflow from plain-language goal without mutation.", exampleInput: { goal: "Summarize form responses" } }),
  c({ name: "create_workflow_draft", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowDraft", note: "Creates an unapplied workflow draft.", exampleInput: { goal: "Summarize form responses" } }),
  c({ name: "answer_workflow_draft_questions", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowDraft", note: "Updates non-sensitive draft fields and rejects secret-looking answers.", exampleInput: { draftId: "draft-id", answers: { subject: "Hello" } } }),
  c({ name: "validate_workflow_draft", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowDraft", note: "Refreshes validation state on a draft.", nativeOutputSchema: true, exampleInput: { draftId: "draft-id" } }),
  c({ name: "explain_workflow", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "workflowGraph", note: "Explains a saved workflow or draft.", exampleInput: { workflowId: "workflow-id" } }),
  c({ name: "preview_workflow_diff", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "workflowDiff", note: "Computes diff and confirmation hash before applying draft.", exampleInput: { draftId: "draft-id" } }),
  c({ name: "apply_workflow_draft", domain: "workflows", source: "src/mcp/tools/workflows/workflow-drafts.tool.ts", profiles: chatgptProfiles, requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Applies draft after approval and matching confirmation hash.", requiresApproval: true, exampleInput: { draftId: "draft-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "rename_workflow", domain: "workflows", source: "src/mcp/tools/workflows/workflow-mutations.tool.ts", requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowMutation", note: "Renames workflow and creates a version snapshot.", exampleInput: { id: "workflow-id", name: "New name" } }),
  c({ name: "delete_workflow", domain: "workflows", source: "src/mcp/tools/workflows/workflow-mutations.tool.ts", requiredScopes: ["workflows:write"], risk: "admin_or_destructive", outputSchema: "textMessage", note: "Permanently deletes workflow after approval and confirmation hash.", requiresApproval: true, destructive: true, forbiddenInChatGpt: true, exampleInput: { id: "workflow-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "execute_workflow", domain: "workflows", source: "src/mcp/tools/workflows/workflow-mutations.tool.ts", requiredScopes: ["workflows:execute"], risk: "external_side_effect", outputSchema: "executionDetail", note: "Triggers workflow asynchronously after explicit approval.", requiresApproval: true, externalSideEffect: true, openWorldHint: true, exampleInput: { id: "workflow-id", approved: true } }),
  c({ name: "list_workflow_versions", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "genericObject", note: "Lists workflow version snapshots.", exampleInput: { workflowId: "workflow-id" } }),
  c({ name: "duplicate_workflow", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "draft_write", outputSchema: "workflowMutation", note: "Duplicates a workflow.", exampleInput: { workflowId: "workflow-id", name: "Copy" } }),
  c({ name: "rollback_workflow_version", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Restores a workflow version after approval and confirmation.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", versionId: "version-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "add_workflow_node", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Adds a node after validation and approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "update_node_config", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Updates node config after validation and approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", nodeId: "node-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "connect_workflow_nodes", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Connects nodes after validation and approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", sourceNodeId: "a", targetNodeId: "b", approved: true, confirmationHash: "hash" } }),
  c({ name: "disconnect_workflow_nodes", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Disconnects nodes after validation and approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", connectionId: "connection-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "remove_workflow_node", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Removes a node after validation and approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", nodeId: "node-id", approved: true, confirmationHash: "hash" } }),
  c({ name: "move_workflow_node", domain: "workflows", source: "src/mcp/tools/workflows/workflow-versioning.tool.ts", requiredScopes: ["workflows:write"], risk: "approval_gated_write", outputSchema: "approvalResult", note: "Moves a workflow node after approval.", requiresApproval: true, exampleInput: { workflowId: "workflow-id", nodeId: "node-id", position: { x: 0, y: 0 }, approved: true, confirmationHash: "hash" } }),

  c({ name: "render_workflow_draft_preview", domain: "apps", source: "src/mcp/apps/render-tools.ts", profiles: chatgptOnly, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "renderWidget", note: "Renders sanitized workflow draft preview widget.", nativeOutputSchema: true, exampleInput: { draftId: "draft-id" } }),
  c({ name: "render_workflow_setup_checklist", domain: "apps", source: "src/mcp/apps/render-tools.ts", profiles: chatgptOnly, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "renderWidget", note: "Renders sanitized setup checklist widget.", nativeOutputSchema: true, exampleInput: { workflowId: "workflow-id" } }),
  c({ name: "render_execution_timeline", domain: "apps", source: "src/mcp/apps/render-tools.ts", profiles: chatgptOnly, requiredScopes: ["executions:read"], risk: "read_only", outputSchema: "renderWidget", note: "Renders sanitized execution timeline widget.", nativeOutputSchema: true, exampleInput: { executionId: "execution-id" } }),
  c({ name: "render_workflow_approval", domain: "apps", source: "src/mcp/apps/render-tools.ts", profiles: chatgptOnly, requiredScopes: ["workflows:read"], risk: "read_only", outputSchema: "renderWidget", note: "Renders sanitized approval widget.", nativeOutputSchema: true, exampleInput: { draftId: "draft-id" } }),
];

export const CHATGPT_TOOL_CONTRACTS = MCP_TOOL_CONTRACTS.filter((tool) =>
  tool.profiles.includes("chatgpt"),
);

export const DEFAULT_TOOL_CONTRACTS = MCP_TOOL_CONTRACTS.filter((tool) =>
  tool.profiles.includes("default"),
);

export const FORBIDDEN_CHATGPT_TOOL_CONTRACTS = MCP_TOOL_CONTRACTS.filter(
  (tool) => tool.forbiddenInChatGpt,
);

export function getToolContract(name: string): McpToolContract | undefined {
  return MCP_TOOL_CONTRACTS.find((tool) => tool.name === name);
}
