import { ADVERSARIAL_CASES } from "@/mcp/evals/adversarial";
import { MCP_TOOL_CONTRACTS } from "@/mcp/contracts/tools.manifest";

export const MCP_SECURITY_POLICY_VERSION = "2026.07.phase14";

export const MCP_SECURITY_POLICY = {
  version: MCP_SECURITY_POLICY_VERSION,
  sourceOfTruth: "src/mcp/contracts/tools.manifest.ts",
  stopShipRules: [
    "No secret leakage in MCP output, audit logs, widget HTML, or generated evidence.",
    "No cross-tenant read or write succeeds.",
    "No destructive or external side-effect tool runs without approval.",
    "No OAuth token, authorization code, redirect URI, resource, or client validation bypass.",
    "No ChatGPT profile exposure for forbidden admin/destructive tools.",
    "No prompt-injection regression that leads to unsafe tool selection.",
    "No wildcard CORS, disabled audit persistence, or in-memory rate limiting in multi-instance production.",
  ],
  workspaceGuardrails: {
    disableSideEffectsEnv: "MCP_DISABLE_SIDE_EFFECT_TOOLS",
    disableCredentialMutationEnv: "MCP_DISABLE_CREDENTIAL_MUTATION",
    readOnlyChatGptEnv: "MCP_FORCE_READ_ONLY_CHATGPT_PROFILE",
    outboundAllowlistEnv: "MCP_SAFE_FETCH_ALLOWLIST_DOMAINS",
    outboundAllowlistModeEnv: "MCP_SAFE_FETCH_ALLOWLIST_MODE",
  },
  semanticSafety: {
    classifier: "local-heuristic-v1",
    mode: "defense-in-depth",
    primaryControls: [
      "structured contract policy",
      "prompt-injection warning patterns",
      "approval guard",
      "output redaction",
      "egress allowlist",
    ],
  },
  redTeamCadence: "quarterly",
  responsibleDisclosureContact: "security@flownode.com",
  tools: MCP_TOOL_CONTRACTS.map((tool) => ({
    name: tool.name,
    domain: tool.domain,
    profiles: tool.profiles,
    requiredScopes: tool.requiredScopes,
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    externalSideEffect: tool.externalSideEffect,
    destructive: tool.destructive,
    admin: tool.admin,
    forbiddenInChatGpt: tool.forbiddenInChatGpt,
  })),
  adversarialCoverage: [...new Set(ADVERSARIAL_CASES.map((item) => item.category))].sort(),
} as const;

export function getMcpPolicyGaps() {
  const highRiskWithoutApproval = MCP_SECURITY_POLICY.tools
    .filter(
      (tool) =>
        (tool.externalSideEffect ||
          tool.destructive ||
          tool.risk === "approval_gated_write") &&
        !tool.requiresApproval,
    )
    .map((tool) => tool.name);
  const chatGptForbiddenExposure = MCP_SECURITY_POLICY.tools
    .filter((tool) => tool.forbiddenInChatGpt && tool.profiles.includes("chatgpt"))
    .map((tool) => tool.name);
  const adminChatGptExposure = MCP_SECURITY_POLICY.tools
    .filter((tool) => tool.admin && tool.profiles.includes("chatgpt"))
    .map((tool) => tool.name);

  return {
    highRiskWithoutApproval,
    chatGptForbiddenExposure,
    adminChatGptExposure,
  };
}
