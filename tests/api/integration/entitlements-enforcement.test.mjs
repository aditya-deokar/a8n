import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import {
  createAppCaller,
  expectTrpcCode,
  installApiModuleMocks,
  polarGetStateExternalMock,
  resetApiTestMocks,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";
import { prismaMock } from "../helpers/mock-prisma.mjs";

const FLAG = "ENTITLEMENTS_ENABLED";

function quotaPayloadOf(error) {
  if (error?.cause && typeof error.cause === "object") return error.cause;
  return error?.data ?? {};
}

function futurePeriodEnd() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function setPlanRow(plan) {
  prismaMock.subscription.findUnique.mockResolvedValue(
    plan === "pro"
      ? {
          planId: "pro",
          status: "active",
          currentPeriodEnd: futurePeriodEnd(),
        }
      : null,
  );
}

async function loadConsumeModule() {
  vi.resetModules();
  installApiModuleMocks();
  return import("@/lib/entitlements/consume");
}

describe("entitlements enforcement (flag off — legacy paywall)", () => {
  beforeEach(() => {
    delete process.env[FLAG];
    resetApiTestMocks();
    setApiUser(apiUsers.userAFree);
    setPremiumSubscription(false);
  });

  afterEach(() => {
    delete process.env[FLAG];
  });

  it("blocks workflow creation for non-subscribers exactly as before", async () => {
    const caller = await createAppCaller();

    const error = await caller.workflows.create().catch((e) => e);
    expectTrpcCode(error, "FORBIDDEN");
    expect(polarGetStateExternalMock).toHaveBeenCalled();
  });

  it("still allows creation for active subscribers without quota math", async () => {
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
    const caller = await createAppCaller();

    await expect(caller.workflows.create()).resolves.toMatchObject({
      id: "workflow_created",
      userId: apiUsers.userAPro.id,
    });
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
  });
});

describe("entitlements enforcement (flag on — freemium quotas)", () => {
  beforeEach(() => {
    process.env[FLAG] = "true";
    resetApiTestMocks();
    setApiUser(apiUsers.userAPro);
  });

  afterEach(() => {
    delete process.env[FLAG];
  });

  it("allows a free user to create within the 5-workflow limit without calling Polar", async () => {
    setPlanRow("free");
    prismaMock.workflow.count.mockResolvedValue(3);
    const caller = await createAppCaller();

    await expect(caller.workflows.create()).resolves.toMatchObject({
      id: "workflow_created",
    });
    expect(polarGetStateExternalMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("denies the 6th workflow with structured QUOTA_EXCEEDED metadata", async () => {
    setPlanRow("free");
    prismaMock.workflow.count.mockResolvedValue(5);
    const caller = await createAppCaller();

    const error = await caller.workflows.create().catch((e) => e);
    expectTrpcCode(error, "FORBIDDEN");
    expect(quotaPayloadOf(error)).toMatchObject({
      code: "QUOTA_EXCEEDED",
      feature: "workflow",
      plan: "free",
      used: 5,
      limit: 5,
    });
    expect(polarGetStateExternalMock).not.toHaveBeenCalled();
  });

  it("denies credential creation at the free limit of 10", async () => {
    setPlanRow("free");
    prismaMock.credential.count.mockResolvedValue(10);
    const caller = await createAppCaller();

    const error = await caller.credentials
      .create({ name: "key", type: "OPENAI", value: "sk-test" })
      .catch((e) => e);
    expectTrpcCode(error, "FORBIDDEN");
    expect(quotaPayloadOf(error)).toMatchObject({
      code: "QUOTA_EXCEEDED",
      feature: "credential",
      used: 10,
      limit: 10,
    });
  });

  it("does not count unlimited pro users", async () => {
    setPlanRow("pro");
    prismaMock.workflow.count.mockResolvedValue(500);
    const caller = await createAppCaller();

    await expect(caller.workflows.create()).resolves.toMatchObject({
      id: "workflow_created",
    });
  });

  it("enforces the daily execution abuse guard with quota metadata", async () => {
    setPlanRow("free");
    prismaMock.usageCounter.updateMany.mockResolvedValue({ count: 0 });
    const caller = await createAppCaller();

    const error = await caller.workflows.execute({ id: "workflow_a" }).catch((e) => e);
    expectTrpcCode(error, "FORBIDDEN");
    expect(quotaPayloadOf(error)).toMatchObject({
      code: "QUOTA_EXCEEDED",
      feature: "workflow_execution",
    });
    expect(prismaMock.usageCounter.updateMany).toHaveBeenCalled();
  });

  it("consumes chat quota atomically and denies at the monthly cap", async () => {
    setPlanRow("free");
    const { consumeChatQuota } = await loadConsumeModule();

    prismaMock.agentRun.findUnique.mockResolvedValue(null);
    prismaMock.usageCounter.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.usageCounter.findUnique.mockResolvedValue({ used: 25 });

    let caught = null;
    try {
      await consumeChatQuota({
        userId: apiUsers.userAPro.id,
        threadId: "thread_1",
        clientMessageId: "cm_1",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught?.name).toBe("QuotaExceededError");
    expect(caught.toPayload()).toMatchObject({
      code: "QUOTA_EXCEEDED",
      feature: "agent_chat",
      used: 25,
      limit: 25,
    });
    expect(caught.details.windowResetAt).toBeInstanceOf(Date);

    const updateWhere = prismaMock.usageCounter.updateMany.mock.calls.at(-1)?.[0];
    expect(updateWhere.where.used).toEqual({ lt: 25 });
    expect(updateWhere.data).toEqual({ used: { increment: 1 } });
  });

  it("never double-chats on client retries of the same message", async () => {
    setPlanRow("free");
    const { consumeChatQuota } = await loadConsumeModule();

    prismaMock.agentRun.findUnique.mockResolvedValue({ id: "run_existing" });

    const result = await consumeChatQuota({
      userId: apiUsers.userAPro.id,
      threadId: "thread_1",
      clientMessageId: "cm_replay",
    });

    expect(result).toMatchObject({ allowed: true, idempotentReplay: true });
    expect(prismaMock.usageCounter.updateMany).not.toHaveBeenCalled();
  });

  it("still consumes counters under the pro hard chat cap (D3)", async () => {
    setPlanRow("pro");
    const { consumeChatQuota } = await loadConsumeModule();

    const result = await consumeChatQuota({ userId: apiUsers.userAPro.id });

    expect(result.allowed).toBe(true);
    expect(prismaMock.usageCounter.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.usageCounter.updateMany).toHaveBeenCalledTimes(1);
    const updateWhere = prismaMock.usageCounter.updateMany.mock.calls.at(-1)?.[0];
    expect(updateWhere.where.used).toEqual({ lt: 500 });
  });
});
