import { beforeEach, describe, expect, it } from "vitest";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import {
  expectTrpcCode,
  loadTrpcInit,
  resetApiTestMocks,
  setAnonymousApiUser,
  setApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";

describe("tRPC middleware", () => {
  beforeEach(() => {
    resetApiTestMocks();
  });

  it("injects authenticated session data into protected procedures", async () => {
    setApiUser(apiUsers.userAPro);
    const { createTRPCRouter, protectedProcedure } = await loadTrpcInit();
    const router = createTRPCRouter({
      whoami: protectedProcedure.query(({ ctx }) => ctx.auth.user.id),
    });

    await expect(router.createCaller({}).whoami()).resolves.toBe(apiUsers.userAPro.id);
  });

  it("rejects missing sessions for protected procedures", async () => {
    setAnonymousApiUser();
    const { createTRPCRouter, protectedProcedure } = await loadTrpcInit();
    const router = createTRPCRouter({
      whoami: protectedProcedure.query(({ ctx }) => ctx.auth.user.id),
    });

    await expect(router.createCaller({}).whoami()).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "UNAUTHORIZED");
      return true;
    });
  });

  it("injects customer state into premium procedures for active subscribers", async () => {
    setApiUser(apiUsers.userAPro);
    setPremiumSubscription(true);
    const { createTRPCRouter, premiumProcedure } = await loadTrpcInit();
    const router = createTRPCRouter({
      premium: premiumProcedure.query(({ ctx }) => ({
        userId: ctx.auth.user.id,
        activeSubscriptions: ctx.customer.activeSubscriptions.length,
      })),
    });

    await expect(router.createCaller({}).premium()).resolves.toEqual({
      userId: apiUsers.userAPro.id,
      activeSubscriptions: 1,
    });
  });

  it("rejects authenticated users without active subscriptions for premium procedures", async () => {
    setApiUser(apiUsers.userAFree);
    setPremiumSubscription(false);
    const { createTRPCRouter, premiumProcedure } = await loadTrpcInit();
    const router = createTRPCRouter({
      premium: premiumProcedure.query(() => "ok"),
    });

    await expect(router.createCaller({}).premium()).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "FORBIDDEN");
      return true;
    });
  });
});
