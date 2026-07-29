export type FeatureFlagKey =
  | "newWorkflowEditor"
  | "apiCanary"
  | "mcpEnhancedTooling"
  | "credentialRotationFlow"
  | "embeddedAgent"
  | "embeddedAgentApply"
  | "agentLongTermMemory"
  | "agentProviderFallback";

export type KillSwitchKey =
  | "disableWorkflowExecution"
  | "disableWebhookProcessing"
  | "disableMcpMutations"
  | "readOnlyMode"
  | "disableAgentRuns"
  | "disableAgentMutations";

export type ExperimentKey = "workflowOnboardingV2";

export type FeatureFlagDefinition = {
  key: FeatureFlagKey;
  defaultEnabled: boolean;
  rolloutPercent: number;
  rolloutEnv: string;
  owner: string;
  description: string;
};

export type KillSwitchDefinition = {
  key: KillSwitchKey;
  env: string;
  owner: string;
  description: string;
};

export type ExperimentDefinition = {
  key: ExperimentKey;
  owner: string;
  description: string;
  variantOverrideEnv: string;
  variants: Array<{
    key: string;
    weight: number;
  }>;
  primaryMetric: string;
  guardrailMetrics: string[];
};

export const featureFlags: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  newWorkflowEditor: {
    key: "newWorkflowEditor",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_NEW_WORKFLOW_EDITOR_ROLLOUT_PERCENT",
    owner: "product",
    description: "Gradual rollout for the next workflow editing experience.",
  },
  apiCanary: {
    key: "apiCanary",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_API_CANARY_ROLLOUT_PERCENT",
    owner: "backend",
    description: "Routes selected users through new internal API behavior.",
  },
  mcpEnhancedTooling: {
    key: "mcpEnhancedTooling",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_MCP_ENHANCED_TOOLING_ROLLOUT_PERCENT",
    owner: "mcp",
    description: "Enables new MCP tool behavior for selected users.",
  },
  credentialRotationFlow: {
    key: "credentialRotationFlow",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_CREDENTIAL_ROTATION_FLOW_ROLLOUT_PERCENT",
    owner: "security",
    description: "Enables credential rotation workflow improvements.",
  },
  embeddedAgent: {
    key: "embeddedAgent",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_EMBEDDED_AGENT_ROLLOUT_PERCENT",
    owner: "ai-platform",
    description: "Enables the embedded workflow agent in the editor.",
  },
  embeddedAgentApply: {
    key: "embeddedAgentApply",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_EMBEDDED_AGENT_APPLY_ROLLOUT_PERCENT",
    owner: "ai-platform",
    description: "Enables approval-gated agent workflow application.",
  },
  agentLongTermMemory: {
    key: "agentLongTermMemory",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_AGENT_LONG_TERM_MEMORY_ROLLOUT_PERCENT",
    owner: "ai-platform",
    description: "Enables user-scoped long-term agent memory.",
  },
  agentProviderFallback: {
    key: "agentProviderFallback",
    defaultEnabled: false,
    rolloutPercent: 0,
    rolloutEnv: "FEATURE_FLAG_AGENT_PROVIDER_FALLBACK_ROLLOUT_PERCENT",
    owner: "ai-platform",
    description: "Enables configured model-provider fallback behavior.",
  },
};

export const killSwitches: Record<KillSwitchKey, KillSwitchDefinition> = {
  disableWorkflowExecution: {
    key: "disableWorkflowExecution",
    env: "KILL_SWITCH_DISABLE_WORKFLOW_EXECUTION",
    owner: "backend",
    description: "Stops new workflow execution dispatches during incidents.",
  },
  disableWebhookProcessing: {
    key: "disableWebhookProcessing",
    env: "KILL_SWITCH_DISABLE_WEBHOOK_PROCESSING",
    owner: "integrations",
    description: "Returns controlled 503 responses for external webhook traffic.",
  },
  disableMcpMutations: {
    key: "disableMcpMutations",
    env: "KILL_SWITCH_DISABLE_MCP_MUTATIONS",
    owner: "mcp",
    description: "Blocks MCP write, admin, and external side-effect tools during incidents.",
  },
  readOnlyMode: {
    key: "readOnlyMode",
    env: "KILL_SWITCH_READ_ONLY_MODE",
    owner: "platform",
    description: "Reserved global read-only mode for high-risk incidents.",
  },
  disableAgentRuns: {
    key: "disableAgentRuns",
    env: "KILL_SWITCH_DISABLE_AGENT_RUNS",
    owner: "ai-platform",
    description: "Stops new embedded agent runs during incidents.",
  },
  disableAgentMutations: {
    key: "disableAgentMutations",
    env: "KILL_SWITCH_DISABLE_AGENT_MUTATIONS",
    owner: "ai-platform",
    description: "Blocks embedded agent draft and workflow mutations.",
  },
};

export const experiments: Record<ExperimentKey, ExperimentDefinition> = {
  workflowOnboardingV2: {
    key: "workflowOnboardingV2",
    owner: "product",
    description: "Tests guided workflow onboarding against the current creation flow.",
    variantOverrideEnv: "EXPERIMENT_WORKFLOW_ONBOARDING_V2_VARIANT",
    variants: [
      { key: "control", weight: 50 },
      { key: "guided_setup", weight: 50 },
    ],
    primaryMetric: "workflow_created_within_24h",
    guardrailMetrics: ["api_5xx_rate", "workflow_execution_failure_rate", "support_contact_rate"],
  },
};
