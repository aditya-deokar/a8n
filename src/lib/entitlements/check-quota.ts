import type { PlanId, QuotaFeature } from "@/config/plans";

export interface QuotaVerdict {
  allowed: boolean;
  feature: QuotaFeature;
  plan: PlanId;
  used: number;
  limit: number | null;
}

export function evaluateQuota(params: {
  plan: PlanId;
  feature: QuotaFeature;
  used: number;
  limit: number | null;
}): QuotaVerdict {
  const { plan, feature, used, limit } = params;
  if (limit === null) {
    return { allowed: true, feature, plan, used, limit };
  }
  return { allowed: used < limit, feature, plan, used, limit };
}
