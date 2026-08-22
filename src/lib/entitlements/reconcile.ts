import prisma from "@/lib/db";
import { polarClient } from "@/lib/polar";
import { isE2EMode } from "@/lib/e2e-safety";
import { logger } from "@/lib/logging";
import {
  applyCustomerState,
  normalizeCustomerState,
} from "@/lib/entitlements/sync";

export interface ReconciliationDriftDetail {
  userId: string;
  fields: string[];
}

export interface BillingReconciliationReport {
  scanned: number;
  drifts: number;
  repaired: number;
  errors: number;
  countersScanned: number;
  countersRepaired: number;
  details: ReconciliationDriftDetail[];
  generatedAt: string;
}

interface SubscriptionRowLike {
  userId: string;
  status: string;
  planId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function subscriptionDiffs(
  row: SubscriptionRowLike,
  normalized: ReturnType<typeof normalizeCustomerState>,
): string[] {
  const fields: string[] = [];
  if (row.status !== normalized.status) fields.push("status");
  if (row.planId !== normalized.planId) fields.push("planId");
  const rowPeriod = row.currentPeriodEnd?.toISOString() ?? null;
  const newPeriod = normalized.currentPeriodEnd?.toISOString() ?? null;
  if (rowPeriod !== newPeriod) fields.push("currentPeriodEnd");
  if (row.cancelAtPeriodEnd !== normalized.cancelAtPeriodEnd) {
    fields.push("cancelAtPeriodEnd");
  }
  return fields;
}

async function reconcileSubscriptions(options: {
  now: Date;
  pageSize: number;
  maxPages: number;
  details: ReconciliationDriftDetail[];
}) {
  let cursor: string | undefined;
  let scanned = 0;
  let drifts = 0;
  let repaired = 0;
  let errors = 0;
  let pages = 0;

  while (pages < options.maxPages) {
    const rows = await prisma.subscription.findMany({
      take: options.pageSize,
      orderBy: { id: "asc" },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (rows.length === 0) break;
    pages += 1;

    for (const row of rows) {
      scanned += 1;
      try {
        const state = await polarClient.customers.getStateExternal({
          externalId: row.userId,
        });
        const normalized = normalizeCustomerState(state);
        const fields = subscriptionDiffs(row, normalized);

        if (fields.length > 0) {
          drifts += 1;
          logger.warn(
            {
              component: "billing",
              event: "billing.reconcile.drift",
              userId: row.userId,
              fields,
            },
            "Subscription drift detected; repairing from Polar.",
          );
          await applyCustomerState(state);
          repaired += 1;
          options.details.push({ userId: row.userId, fields });
        }
      } catch (error) {
        errors += 1;
        logger.warn(
          {
            component: "billing",
            event: "billing.reconcile.error",
            userId: row.userId,
            error,
          },
          "Failed to reconcile a subscription against Polar.",
        );
      }
    }

    cursor = rows[rows.length - 1]?.id;
  }

  return { scanned, drifts, repaired, errors };
}

/**
 * Cross-checks active chat windows against the immutable AgentRun ledger and
 * resets drifted counters to database truth.
 */
async function reconcileUsageCounters(now: Date) {
  const counters = await prisma.usageCounter.findMany({
    where: {
      resource: "agent_chat",
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    select: { id: true, userId: true, periodStart: true, used: true },
  });

  let repaired = 0;

  for (const counter of counters) {
    const expected = await prisma.agentRun.count({
      where: {
        userId: counter.userId,
        createdAt: { gte: counter.periodStart, lt: now },
      },
    });

    if (expected !== counter.used) {
      logger.warn(
        {
          component: "billing",
          event: "billing.reconcile.counter_drift",
          userId: counter.userId,
          recorded: counter.used,
          expected,
        },
        "Chat usage counter drift detected; resetting to ledger truth.",
      );
      await prisma.usageCounter.update({
        where: { id: counter.id },
        data: { used: expected },
      });
      repaired += 1;
    }
  }

  return { countersScanned: counters.length, countersRepaired: repaired };
}

export async function runBillingReconciliation(
  options: { pageSize?: number; maxPages?: number; now?: Date } = {},
): Promise<BillingReconciliationReport> {
  const now = options.now ?? new Date();
  const details: ReconciliationDriftDetail[] = [];

  if (isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock") {
    return {
      scanned: 0,
      drifts: 0,
      repaired: 0,
      errors: 0,
      countersScanned: 0,
      countersRepaired: 0,
      details,
      generatedAt: now.toISOString(),
    };
  }

  const subscriptions = await reconcileSubscriptions({
    now,
    pageSize: options.pageSize ?? 50,
    maxPages: options.maxPages ?? 100,
    details,
  });

  const counters = await reconcileUsageCounters(now);

  return {
    ...subscriptions,
    ...counters,
    details,
    generatedAt: now.toISOString(),
  };
}
