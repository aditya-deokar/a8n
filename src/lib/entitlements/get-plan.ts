import prisma from "@/lib/db";
import { isE2EMode } from "@/lib/e2e-safety";
import type { PlanId } from "@/config/plans";

export type SubscriptionPlanRow = {
  planId: string;
  status: string;
  currentPeriodEnd: Date | null;
} | null;

/**
 * Minimal structural client so quota sections can resolve plans on their OWN
 * transaction connection. Using the global prisma client inside a transaction
 * deadlocks under pool saturation: every pooled connection is held by
 * concurrent transactions while the holder waits for a free slot.
 */
export interface PlanReadClient {
  subscription: {
    findUnique: (args: {
      where: { userId: string };
      select: { planId: true; status: true; currentPeriodEnd: true };
    }) => Promise<SubscriptionPlanRow>;
  };
}

const ACTIVE_STATUSES = new Set(["active"]);
const GRACE_STATUSES = new Set(["past_due", "trialing"]);

export function resolvePlanFromSubscription(
  subscription: SubscriptionPlanRow,
  now: Date = new Date(),
): PlanId {
  if (!subscription) return "free";
  if (subscription.planId !== "pro") return "free";

  if (ACTIVE_STATUSES.has(subscription.status)) return "pro";

  const periodEnd = subscription.currentPeriodEnd;
  const periodStillActive = Boolean(periodEnd && periodEnd > now);

  if (GRACE_STATUSES.has(subscription.status) && periodStillActive) {
    return "pro";
  }
  if (subscription.status === "canceled" && periodStillActive) {
    return "pro";
  }

  return "free";
}

function mockedExternalServices() {
  return isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";
}

function e2eMockedPlan(user: { id?: string; email?: string }): PlanId {
  const identity = `${user.id ?? ""} ${user.email ?? ""}`.toLowerCase();
  return identity.includes("pro") ? "pro" : "free";
}

export async function getEffectivePlan(
  userId: string,
  user?: { id?: string; email?: string },
  options?: { client?: PlanReadClient },
): Promise<PlanId> {
  if (mockedExternalServices()) {
    return e2eMockedPlan(user ?? { id: userId });
  }

  const db = (options?.client ?? prisma) as typeof prisma;
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { planId: true, status: true, currentPeriodEnd: true },
  });

  return resolvePlanFromSubscription(subscription);
}
