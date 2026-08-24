import type { PlanId, QuotaFeature } from "@/config/plans";

export interface QuotaDetails {
  feature: QuotaFeature;
  plan: PlanId;
  used: number;
  limit: number;
  windowResetAt?: Date | null;
}

export function quotaMessage(details: QuotaDetails): string {
  switch (details.feature) {
    case "workflow":
      return `You've used ${details.used} of ${details.limit} free workflows. Upgrade to Pro for unlimited workflows.`;
    case "credential":
      return `You've used ${details.used} of ${details.limit} free credentials. Upgrade to Pro for unlimited credentials.`;
    case "agent_chat":
      return `You've used all ${details.limit} chats for this month. Your quota resets on the 1st, or upgrade to Pro for more.`;
    case "workflow_execution":
      return `Daily workflow execution limit reached (${details.limit}). Try again tomorrow or upgrade your plan.`;
  }
}

export interface QuotaErrorPayload {
  code: "QUOTA_EXCEEDED";
  feature: QuotaFeature;
  plan: PlanId;
  used: number;
  limit: number;
  windowResetAt: string | null;
  upgradeUrl: string;
}

export class QuotaExceededError extends Error {
  readonly details: QuotaDetails;

  constructor(details: QuotaDetails) {
    super(quotaMessage(details));
    this.name = "QuotaExceededError";
    this.details = details;
  }

  toPayload(): QuotaErrorPayload {
    return {
      code: "QUOTA_EXCEEDED",
      feature: this.details.feature,
      plan: this.details.plan,
      used: this.details.used,
      limit: this.details.limit,
      windowResetAt: this.details.windowResetAt
        ? this.details.windowResetAt.toISOString()
        : null,
      upgradeUrl: "/checkout/pro",
    };
  }
}
