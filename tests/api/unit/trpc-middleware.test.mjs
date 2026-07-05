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

async function captureLogEvents() {
  const { logger } = await import("@/lib/logging");
  const events = [];
  const original = {
    debug: logger.debug,
    info: logger.info,
    warn: logger.warn,
    error: logger.error,
    fatal: logger.fatal,
    child: logger.child,
  };

  for (const level of ["debug", "info", "warn", "error", "fatal"]) {
    logger[level] = (fields, message) => {
      events.push({ level, fields, message });
    };
  }
  logger.child = () => logger;

  return {
    events,
    logger,
    restore() {
      Object.assign(logger, original);
    },
  };
}

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

  it("logs successful protected procedure completion with request and user context", async () => {
    setApiUser(apiUsers.userAPro);
    const { createTRPCRouter, protectedProcedure } = await loadTrpcInit();
    const capture = await captureLogEvents();

    try {
      const router = createTRPCRouter({
        whoami: protectedProcedure.query(({ ctx }) => ctx.auth.user.id),
      });

      await expect(
        router.createCaller({
          requestId: "req_trpc_success",
          correlationId: "req_trpc_success",
          requestLogger: capture.logger,
        }).whoami(),
      ).resolves.toBe(apiUsers.userAPro.id);

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "info",
          fields: expect.objectContaining({
            component: "trpc",
            event: "trpc_procedure_completed",
            procedurePath: "whoami",
            procedureType: "query",
            requestId: "req_trpc_success",
            userId: apiUsers.userAPro.id,
          }),
        }),
      );
    } finally {
      capture.restore();
    }
  });

  it("logs unauthorized protected procedure attempts safely", async () => {
    setAnonymousApiUser();
    const { createTRPCRouter, protectedProcedure } = await loadTrpcInit();
    const capture = await captureLogEvents();

    try {
      const router = createTRPCRouter({
        whoami: protectedProcedure.query(({ ctx }) => ctx.auth.user.id),
      });

      await expect(
        router.createCaller({
          requestId: "req_trpc_unauthorized",
          correlationId: "req_trpc_unauthorized",
          requestLogger: capture.logger,
        }).whoami(),
      ).rejects.toSatisfy((error) => {
        expectTrpcCode(error, "UNAUTHORIZED");
        return true;
      });

      expect(capture.events).toContainEqual(
        expect.objectContaining({
          level: "warn",
          fields: expect.objectContaining({
            component: "trpc",
            event: "trpc_auth_failed",
            procedurePath: "whoami",
            procedureType: "query",
            requestId: "req_trpc_unauthorized",
            trpcErrorCode: "UNAUTHORIZED",
          }),
        }),
      );
    } finally {
      capture.restore();
    }
  });

  it("logs failed premium mutations without procedure input", async () => {
    setApiUser(apiUsers.userAFree);
    setPremiumSubscription(false);
    const { createTRPCRouter, premiumProcedure } = await loadTrpcInit();
    const capture = await captureLogEvents();

    try {
      const router = createTRPCRouter({
        premium: premiumProcedure.mutation(() => "ok"),
      });

      await expect(
        router.createCaller({
          requestId: "req_trpc_failure",
          correlationId: "req_trpc_failure",
          requestLogger: capture.logger,
        }).premium(),
      ).rejects.toSatisfy((error) => {
        expectTrpcCode(error, "FORBIDDEN");
        return true;
      });

      const failureEvent = capture.events.find(
        (event) => event.fields?.event === "trpc_procedure_failed",
      );

      expect(failureEvent).toMatchObject({
        level: "warn",
        fields: expect.objectContaining({
          component: "trpc",
          procedurePath: "premium",
          procedureType: "mutation",
          requestId: "req_trpc_failure",
          trpcErrorCode: "FORBIDDEN",
          userId: apiUsers.userAFree.id,
        }),
      });
      expect(JSON.stringify(failureEvent.fields)).not.toContain("secret");
      expect(JSON.stringify(failureEvent.fields)).not.toContain("input");
    } finally {
      capture.restore();
    }
  });
});
