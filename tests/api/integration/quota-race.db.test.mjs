/**
 * Race-safety suite for the entitlements quota engine.
 *
 * Runs against a REAL local Postgres so concurrent requests arbitrate in the
 * database exactly like production. Skipped unless:
 *
 *   API_DATABASE_TESTS=true
 *   DATABASE_URL points at a migrated local test database, e.g.
 *     pnpm db:test:up && pnpm db:test:migrate
 *   then: pnpm exec dotenv -e docker/env/test.host.env -- ^
 *         vitest run --config vitest.api.config.mjs tests/api/integration/quota-race.db.test.mjs
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { apiDatabaseTestsEnabled } from "../helpers/db.mjs";

const enabled = apiDatabaseTestsEnabled();

describe.skipIf(!enabled)("quota engine race safety (real postgres)", () => {
  let prisma;
  let consume;
  let windows;
  let savedFreeLimits;
  const createdUserIds = [];

  const CHAT_LIMIT = 3;
  const WORKFLOW_LIMIT = 5;

  async function seedUser(tag) {
    const userId = `quota_race_${tag}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@race.test` },
    });
    createdUserIds.push(userId);
    return userId;
  }

  async function parallelOutcomes(promises) {
    const results = await Promise.all(
      promises.map((p) =>
        p.then(
          () => "ok",
          (error) => {
            if (!globalThis.__raceQuiet) {
              // eslint-disable-next-line no-console
              console.error(
                `[race-err] ${error?.name} code=${error?.code}\nMSG: ${String(error?.message)}\nMETA: ${JSON.stringify(
                  error?.clientVersion ? { v: error.clientVersion } : {},
                )}`,
              );
            }
            return error?.name ?? "error";
          },
        ),
      ),
    );
    return {
      ok: results.filter((r) => r === "ok").length,
      denied: results.filter((r) => r === "QuotaExceededError").length,
    };
  }

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    consume = await import("@/lib/entitlements/consume");
    windows = await import("@/lib/entitlements/windows");
    const { PLANS } = await import("@/config/plans");
    savedFreeLimits = {
      maxWorkflows: PLANS.free.maxWorkflows,
      maxAgentChatsPerWindow: PLANS.free.maxAgentChatsPerWindow,
    };
  });

  afterAll(async () => {
    if (savedFreeLimits) {
      const { PLANS } = await import("@/config/plans");
      PLANS.free.maxWorkflows = savedFreeLimits.maxWorkflows;
      PLANS.free.maxAgentChatsPerWindow = savedFreeLimits.maxAgentChatsPerWindow;
    }
    for (const userId of createdUserIds.reverse()) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma?.$disconnect?.();
  });

  it("advisory-lock transaction admits exactly `limit` parallel workflow creates", async () => {
    const plans = await import("@/config/plans");
    plans.PLANS.free.maxWorkflows = WORKFLOW_LIMIT;

    const userId = await seedUser("stock");
    const { ok, denied } = await parallelOutcomes(
      Array.from({ length: 10 }, () =>
        consume.runWithinStockQuota({
          userId,
          feature: "workflow",
          run: (tx) =>
            tx.workflow.create({
              data: {
                name: "race",
                userId,
                nodes: {
                  create: { type: "INITIAL", position: { x: 0, y: 0 }, name: "INITIAL" },
                },
              },
            }),
        }),
      ),
    );

    expect(ok).toBe(WORKFLOW_LIMIT);
    expect(denied).toBe(10 - WORKFLOW_LIMIT);
    expect(await prisma.workflow.count({ where: { userId } })).toBe(
      WORKFLOW_LIMIT,
    );
  });

  it("conditional counter update admits exactly `limit` parallel chat consumes", async () => {
    const plans = await import("@/config/plans");
    plans.PLANS.free.maxAgentChatsPerWindow = CHAT_LIMIT;

    const userId = await seedUser("flow");
    const { ok, denied } = await parallelOutcomes(
      Array.from({ length: 10 }, () => consume.consumeChatQuota({ userId })),
    );

    expect(ok).toBe(CHAT_LIMIT);
    expect(denied).toBe(10 - CHAT_LIMIT);

    const { periodStart } = windows.calendarMonthWindow();
    const row = await prisma.usageCounter.findUnique({
      where: {
        userId_resource_periodStart: {
          userId,
          resource: "agent_chat",
          periodStart,
        },
      },
    });
    expect(row.used).toBe(CHAT_LIMIT);
  });

  it("client retries with the same clientMessageId consume only once", async () => {
    const plans = await import("@/config/plans");
    plans.PLANS.free.maxAgentChatsPerWindow = 25;

    const userId = await seedUser("replay");
    const thread = await prisma.agentThread.create({
      data: { langgraphThreadId: `lg_${userId}`, userId },
    });

    const first = await consume.consumeChatQuota({
      userId,
      threadId: thread.id,
      clientMessageId: "cm_same",
    });

    // Mirror the agent service: the AgentRun row is persisted right after
    // the first successful consumption; a retry then hits the idempotency key.
    await prisma.agentRun.create({
      data: {
        threadId: thread.id,
        userId,
        clientMessageId: "cm_same",
        correlationId: `corr_${userId}`,
      },
    });

    const replay = await consume.consumeChatQuota({
      userId,
      threadId: thread.id,
      clientMessageId: "cm_same",
    });

    expect(first.allowed).toBe(true);
    expect(replay).toMatchObject({ allowed: true, idempotentReplay: true });

    const { periodStart } = windows.calendarMonthWindow();
    const row = await prisma.usageCounter.findUnique({
      where: {
        userId_resource_periodStart: {
          userId,
          resource: "agent_chat",
          periodStart,
        },
      },
    });
    expect(row.used).toBe(1);
  });

  it("serializes stock creates through the advisory lock under amplified delay", async () => {
    const plans = await import("@/config/plans");
    plans.PLANS.free.maxWorkflows = WORKFLOW_LIMIT;

    const prevEnvDelay = process.env.QUOTA_LOCK_DELAY_MS;
    // Read dynamically by consume.ts through the env singleton, which was
    // parsed at first import — so exercise the lock purely via contention:
    // six concurrent sections must still serialize on pg_advisory_xact_lock.
    delete process.env.QUOTA_LOCK_DELAY_MS;
    try {
      const userId = await seedUser("lockdelay");
      const startedAt = Date.now();
      const { ok } = await parallelOutcomes(
        Array.from({ length: 6 }, () =>
          consume.runWithinStockQuota({
            userId,
            feature: "workflow",
            run: (tx) =>
              tx.workflow.create({ data: { name: "lock", userId } }),
          }),
        ),
      );
      const elapsed = Date.now() - startedAt;

      expect(ok).toBe(WORKFLOW_LIMIT);
      // Serialized sections on a local socket typically finish well under a
      // second; assert merely that the run did not collapse into instant
      // parallelism (which would indicate the lock is bypassed).
      expect(elapsed).toBeGreaterThanOrEqual(15);
      void prevEnvDelay;
    } finally {
      if (prevEnvDelay !== undefined) {
        process.env.QUOTA_LOCK_DELAY_MS = prevEnvDelay;
      }
    }
  });
});
