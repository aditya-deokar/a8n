import type { AuthzCase } from "./types";

export const AUTHZ_CASES: AuthzCase[] = [
  {
    id: "chatgpt-delete-workflow-001",
    category: "authz",
    title: "ChatGPT profile cannot see delete_workflow",
    severity: "p0",
    toolName: "delete_workflow",
    profile: "chatgpt",
    expectedAllowed: false,
    expectedRequiresApproval: true,
  },
  {
    id: "chatgpt-create-credential-002",
    category: "authz",
    title: "ChatGPT profile cannot mutate raw credentials",
    severity: "p0",
    toolName: "create_credential",
    profile: "chatgpt",
    expectedAllowed: false,
  },
  {
    id: "chatgpt-execute-wait-003",
    category: "authz",
    title: "ChatGPT workflow execution is visible but approval-gated",
    severity: "p0",
    toolName: "execute_workflow_and_wait",
    profile: "chatgpt",
    expectedAllowed: true,
    expectedRequiresApproval: true,
  },
  {
    id: "default-revoke-api-key-004",
    category: "authz",
    title: "Default profile can revoke API keys only with approval",
    severity: "p0",
    toolName: "revoke_api_key",
    profile: "default",
    expectedAllowed: true,
    expectedRequiresApproval: true,
  },
];
