import { env } from "@/env";

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const QUOTA_FEATURES = [
  "workflow",
  "credential",
  "agent_chat",
  "workflow_execution",
] as const;
export type QuotaFeature = (typeof QUOTA_FEATURES)[number];

export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  maxWorkflows: number | null;
  maxCredentials: number | null;
  maxAgentChatsPerWindow: number | null;
}

export function resolvePlanLimits() {
  return {
    free: {
      id: "free" as const,
      displayName: "Free",
      maxWorkflows: env.FREE_MAX_WORKFLOWS ?? 5,
      maxCredentials: env.FREE_MAX_CREDENTIALS ?? 10,
      maxAgentChatsPerWindow: env.FREE_AGENT_CHATS_PER_MONTH ?? 25,
    },
    pro: {
      id: "pro" as const,
      displayName: "Pro",
      maxWorkflows: null,
      maxCredentials: null,
      maxAgentChatsPerWindow: env.PRO_AGENT_CHATS_PER_MONTH ?? 500,
    },
  } satisfies Record<PlanId, PlanDefinition>;
}

export type ResolvedPlans = ReturnType<typeof resolvePlanLimits>;

export const PLANS: ResolvedPlans = resolvePlanLimits();

/**
 * D2 (doc subscription/10): hidden per-user daily execution guard applied to
 * every tier in v1. Not surfaced in the UI; exists purely to bound compute
 * from runaway workflows.
 */
export const WORKFLOW_EXECUTION_DAILY_GUARD =
  env.EXECUTIONS_DAILY_ABUSE_GUARD ?? 100;

export function limitForFeature(
  plan: PlanId,
  feature: QuotaFeature,
): number | null {
  const limits = PLANS[plan];
  switch (feature) {
    case "workflow":
      return limits.maxWorkflows;
    case "credential":
      return limits.maxCredentials;
    case "agent_chat":
      return limits.maxAgentChatsPerWindow;
    case "workflow_execution":
      return WORKFLOW_EXECUTION_DAILY_GUARD;
  }
}

export function isEntitlementsEnabled(): boolean {
  return env.ENTITLEMENTS_ENABLED === true;
}

function betaEntitlementUserIds(): Set<string> {
  return new Set(
    (env.ENTITLEMENTS_BETA_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isBetaEntitlementUser(userId: string): boolean {
  return betaEntitlementUserIds().has(userId);
}

export function entitlementsActiveForUser(userId: string): boolean {
  return isEntitlementsEnabled() || isBetaEntitlementUser(userId);
}
