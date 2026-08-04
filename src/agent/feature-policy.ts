import {
  assertKillSwitchOff,
  getFeatureFlagSnapshot,
  isFeatureEnabled,
} from "@/lib/feature-flags";

export type AgentPolicyContext = {
  userId: string;
  email?: string;
  plan?: string;
};

export function assertAgentRunsAllowed(context: AgentPolicyContext): void {
  if (!isFeatureEnabled("embeddedAgent", context)) {
    throw new AgentPolicyError("AGENT_FEATURE_DISABLED", "Embedded agent is not enabled.");
  }

  assertKillSwitchOff("disableAgentRuns");
}

export function agentApplyEnabled(context: AgentPolicyContext): boolean {
  return (
    isFeatureEnabled("embeddedAgentApply", context) &&
    !isKillSwitchEnabledSafely("disableAgentMutations")
  );
}

export function agentMemoryEnabled(context: AgentPolicyContext): boolean {
  return isFeatureEnabled("agentLongTermMemory", context);
}

export function getAgentFlagSnapshot(context: AgentPolicyContext) {
  return {
    runs: getFeatureFlagSnapshot("embeddedAgent", context),
    apply: getFeatureFlagSnapshot("embeddedAgentApply", context),
    memory: getFeatureFlagSnapshot("agentLongTermMemory", context),
    providerFallback: getFeatureFlagSnapshot("agentProviderFallback", context),
  };
}

function isKillSwitchEnabledSafely(key: "disableAgentMutations"): boolean {
  try {
    assertKillSwitchOff(key);
    return false;
  } catch {
    return true;
  }
}

export class AgentPolicyError extends Error {
  constructor(
    public readonly code: "AGENT_FEATURE_DISABLED" | "AGENT_KILL_SWITCHED",
    message: string,
  ) {
    super(message);
    this.name = "AgentPolicyError";
  }
}
