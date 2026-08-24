import prisma from "@/lib/db";
import { env } from "@/env";
import {
  limitForFeature,
  WORKFLOW_EXECUTION_DAILY_GUARD,
  type QuotaFeature,
} from "@/config/plans";
import { getEffectivePlan } from "@/lib/entitlements/get-plan";
import { evaluateQuota } from "@/lib/entitlements/check-quota";
import { calendarMonthWindow, utcDayWindow } from "@/lib/entitlements/windows";
import { QuotaExceededError } from "@/lib/entitlements/errors";
import { throwIfE2EFault } from "@/lib/e2e-faults";
import { logger } from "@/lib/logging";

export type QuotaTx = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const RESOURCE_BY_FEATURE: Record<
  "workflow" | "credential",
  "workflow" | "credential"
> = {
  workflow: "workflow",
  credential: "credential",
};

const PRISMA_UNIQUE_VIOLATION = "P2002";

// Interactive-transaction budget for quota sections. Sections are short, but
// concurrent bursts serialize behind the advisory lock, so the queue must be
// given a ceiling well above Prisma's 5s default or waiters die with P2028.
const QUOTA_TX_MAX_WAIT_MS = 15_000;
const QUOTA_TX_TIMEOUT_MS = 20_000;

async function lockQuotaKey(tx: QuotaTx, userId: string, key: string) {
  // pg_advisory_xact_lock() returns `void`, which $queryRaw cannot
  // deserialize — route it through a CTE that yields a scalar instead.
  await tx.$queryRaw`
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(${`quota:${userId}:${key}`}))
    )
    SELECT 1 AS locked FROM advisory_lock
  `;
}

function quotaLockDelayMs(): number {
  return env.QUOTA_LOCK_DELAY_MS ?? 0;
}

async function countStock(tx: QuotaTx, userId: string, feature: "workflow" | "credential") {
  const resource = RESOURCE_BY_FEATURE[feature];
  if (resource === "workflow") {
    return tx.workflow.count({ where: { userId } });
  }
  return tx.credential.count({ where: { userId } });
}

function logQuotaDenied(params: {
  userId: string;
  feature: QuotaFeature;
  used: number;
  limit: number;
}) {
  logger.warn(
    {
      component: "billing",
      event: "billing.quota.denied",
      userId: params.userId,
      feature: params.feature,
      used: params.used,
      limit: params.limit,
    },
    "Quota denial.",
  );
}

/**
 * Runs `run` inside a transaction that holds a per-user advisory lock for the
 * stock feature, re-counts owned rows under the lock, and denies creation when
 * the effective plan's limit is reached. The insert itself executes on the
 * same transaction, so a denied or failed attempt never leaves partial state.
 */
export async function runWithinStockQuota<T>(params: {
  userId: string;
  feature: "workflow" | "credential";
  run: (tx: QuotaTx) => Promise<T>;
}): Promise<T> {
  throwIfE2EFault(
    "quota-db",
    "Simulated E2E entitlement database failure.",
  );

  return prisma.$transaction(
    async (tx) => {
      await lockQuotaKey(tx, params.userId, params.feature);

      const delayMs = quotaLockDelayMs();
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const used = await countStock(tx, params.userId, params.feature);
      const plan = await getEffectivePlan(
        params.userId,
        undefined,
        { client: tx },
      );
      const limit = limitForFeature(plan, params.feature satisfies QuotaFeature);
      const verdict = evaluateQuota({ plan, feature: params.feature, used, limit });

      if (!verdict.allowed) {
        logQuotaDenied({
          userId: params.userId,
          feature: params.feature,
          used,
          limit: verdict.limit ?? 0,
        });
        throw new QuotaExceededError({
          feature: params.feature,
          plan,
          used,
          limit: verdict.limit ?? 0,
          windowResetAt: null,
        });
      }

      return params.run(tx);
    },
    {
      maxWait: QUOTA_TX_MAX_WAIT_MS,
      timeout: QUOTA_TX_TIMEOUT_MS,
    },
  );
}

export interface ChatConsumeResult {
  allowed: true;
  idempotentReplay?: boolean;
  usedAfter?: number;
  windowResetAt?: Date;
}

async function agentRunExists(threadId: string, clientMessageId: string) {
  const run = await prisma.agentRun.findUnique({
    where: { threadId_clientMessageId: { threadId, clientMessageId } },
    select: { id: true },
  });
  return Boolean(run);
}

/**
 * Lazily creates the window row. Concurrent first-writes race on the unique
 * key; the loser's duplicate insert is ignored because the winner already
 * created the row the guarded increment below operates on.
 */
async function ensureUsageCounterRow(params: {
  userId: string;
  resource: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  try {
    await prisma.usageCounter.upsert({
      where: {
        userId_resource_periodStart: {
          userId: params.userId,
          resource: params.resource,
          periodStart: params.periodStart,
        },
      },
      create: {
        userId: params.userId,
        resource: params.resource,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        used: 0,
      },
      update: {},
    });
  } catch (error) {
    if ((error as { code?: string } | null)?.code !== PRISMA_UNIQUE_VIOLATION) {
      throw error;
    }
  }
}

/**
 * Atomically consumes one chat unit from the current calendar-month window.
 * Replays of an already-recorded (threadId, clientMessageId) pair short-circuit
 * so client retries never double-consume.
 */
export async function consumeChatQuota(params: {
  userId: string;
  threadId?: string;
  clientMessageId?: string;
  now?: Date;
}): Promise<ChatConsumeResult> {
  throwIfE2EFault(
    "quota-db",
    "Simulated E2E entitlement database failure.",
  );

  const now = params.now ?? new Date();

  if (params.threadId && params.clientMessageId) {
    if (await agentRunExists(params.threadId, params.clientMessageId)) {
      return { allowed: true, idempotentReplay: true };
    }
  }

  const plan = await getEffectivePlan(params.userId);
  const limit = limitForFeature(plan, "agent_chat");
  if (limit === null) {
    return { allowed: true };
  }

  const { periodStart, periodEnd } = calendarMonthWindow(now);
  const resource = "agent_chat";

  await ensureUsageCounterRow({
    userId: params.userId,
    resource,
    periodStart,
    periodEnd,
  });

  const updated = await prisma.usageCounter.updateMany({
    where: {
      userId: params.userId,
      resource,
      periodStart,
      used: { lt: limit },
    },
    data: { used: { increment: 1 } },
  });

  if (updated.count === 0) {
    const row = await prisma.usageCounter.findUnique({
      where: {
        userId_resource_periodStart: {
          userId: params.userId,
          resource,
          periodStart,
        },
      },
      select: { used: true },
    });
    logQuotaDenied({
      userId: params.userId,
      feature: "agent_chat",
      used: Math.min(row?.used ?? limit, limit),
      limit,
    });
    throw new QuotaExceededError({
      feature: "agent_chat",
      plan,
      used: Math.min(row?.used ?? limit, limit),
      limit,
      windowResetAt: periodEnd,
    });
  }

  logger.debug(
    {
      component: "billing",
      event: "billing.quota.consume",
      userId: params.userId,
      resource,
    },
    "Chat quota consumed.",
  );

  return { allowed: true, windowResetAt: periodEnd };
}

/**
 * D2 abuse guard: consumes one slot from the user's rolling UTC-day
 * execution counter. Applies to every tier; never surfaced as a plan limit.
 */
export async function consumeExecutionQuota(params: {
  userId: string;
  now?: Date;
}): Promise<ChatConsumeResult> {
  throwIfE2EFault(
    "quota-db",
    "Simulated E2E entitlement database failure.",
  );

  const now = params.now ?? new Date();
  const limit = WORKFLOW_EXECUTION_DAILY_GUARD;
  const { periodStart, periodEnd } = utcDayWindow(now);
  const resource = "workflow_execution";

  await ensureUsageCounterRow({
    userId: params.userId,
    resource,
    periodStart,
    periodEnd,
  });

  const updated = await prisma.usageCounter.updateMany({
    where: {
      userId: params.userId,
      resource,
      periodStart,
      used: { lt: limit },
    },
    data: { used: { increment: 1 } },
  });

  if (updated.count === 0) {
    logQuotaDenied({
      userId: params.userId,
      feature: "workflow_execution",
      used: limit,
      limit,
    });
    throw new QuotaExceededError({
      feature: "workflow_execution",
      plan: await getEffectivePlan(params.userId),
      used: limit,
      limit,
      windowResetAt: periodEnd,
    });
  }

  return { allowed: true, windowResetAt: periodEnd };
}
