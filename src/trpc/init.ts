import { auth } from '@/lib/auth';
import prisma from "@/lib/db";
import {
  createLogger,
  getLogContext,
  logger,
  normalizeError,
  observeExternalProvider,
  requestIdFromHeaders,
  type AppLogger,
  type LogFields,
} from "@/lib/logging";
import { polarClient } from '@/lib/polar';
import { entitlementsActiveForUser } from '@/config/plans';
import { getEffectivePlan } from '@/lib/entitlements/get-plan';
import {
  runWithinStockQuota,
  type QuotaTx,
} from '@/lib/entitlements/consume';
import { quotaTrpcError } from '@/lib/entitlements/trpc-bridge';
import { initTRPC, TRPCError } from '@trpc/server';
import { headers } from 'next/headers';
import { cache } from 'react';
import superjson from "superjson"
import { isE2EMode } from '@/lib/e2e-safety';
import { throwIfE2EFault } from '@/lib/e2e-faults';

const useMockedExternalServices =
  isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";

type CreateTRPCContextOptions = {
  req?: Request;
};

type RequestAwareContext = {
  requestId?: string;
  correlationId?: string;
  requestLogger?: AppLogger;
  auth?: {
    user?: {
      id?: string;
    };
  };
};

function contextFields(ctx: unknown): RequestAwareContext {
  return (ctx || {}) as RequestAwareContext;
}

function userIdFromContext(ctx: unknown) {
  return contextFields(ctx).auth?.user?.id;
}

function requestFields(ctx: unknown): LogFields {
  const trpcContext = contextFields(ctx);
  const activeContext = getLogContext();

  return {
    requestId: trpcContext.requestId || activeContext.requestId,
    correlationId: trpcContext.correlationId || activeContext.correlationId,
    traceId: activeContext.traceId,
    spanId: activeContext.spanId,
    userId: userIdFromContext(ctx),
  };
}

function requestLogger(ctx: unknown) {
  return contextFields(ctx).requestLogger || logger.child({ component: "trpc" });
}

function trpcFailureLevel(code?: string): "warn" | "error" {
  return code === "BAD_REQUEST" ||
    code === "UNAUTHORIZED" ||
    code === "FORBIDDEN" ||
    code === "NOT_FOUND" ||
    code === "METHOD_NOT_SUPPORTED" ||
    code === "CONFLICT" ||
    code === "PRECONDITION_FAILED" ||
    code === "TOO_MANY_REQUESTS"
    ? "warn"
    : "error";
}

function trpcErrorCode(error: unknown) {
  if (error instanceof TRPCError) return error.code;
  const candidate = error as { code?: unknown } | null;
  return typeof candidate?.code === "string" ? candidate.code : undefined;
}

function createE2ECustomerState(user: { id?: string; email?: string }) {
  const identity = `${user.id ?? ""} ${user.email ?? ""}`.toLowerCase();
  const activeSubscriptions = identity.includes("pro")
    ? [{ id: "e2e_subscription_pro", status: "active" }]
    : [];

  return { activeSubscriptions };
}

export const createTRPCContext = cache(async (opts?: CreateTRPCContextOptions) => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const activeContext = getLogContext();
  const requestId =
    activeContext.requestId ||
    (opts?.req ? requestIdFromHeaders(opts.req.headers) : undefined);
  const correlationId = activeContext.correlationId || requestId;

  return {
    userId: activeContext.userId || 'user_123',
    requestId,
    correlationId,
    requestLogger: createLogger({
      component: "trpc",
      requestId,
      correlationId,
      traceId: activeContext.traceId,
      spanId: activeContext.spanId,
    }),
  };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const quotaPayload = extractQuotaCause(error);
    if (!quotaPayload) return shape;
    return {
      ...shape,
      data: { ...shape.data, ...quotaPayload },
    };
  },
});

function extractQuotaCause(
  error: TRPCError,
): Record<string, unknown> | null {
  const cause = error.cause as { code?: unknown } | null | undefined;
  if (cause && typeof cause === "object" && cause.code === "QUOTA_EXCEEDED") {
    return cause as Record<string, unknown>;
  }
  return null;
}
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

const trpcLoggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const started = Date.now();
  const log = requestLogger(ctx);
  const baseFields = {
    ...requestFields(ctx),
    component: "trpc" as const,
    procedurePath: path,
    procedureType: type,
  };

  log.debug(
    {
      ...baseFields,
      event: "trpc_procedure_started",
    },
    "tRPC procedure started.",
  );

  try {
    const result = await next();
    const durationMs = Date.now() - started;

    if (!result.ok) {
      const trpcCode = trpcErrorCode(result.error);
      const fields = {
        ...baseFields,
        event: "trpc_procedure_failed",
        durationMs,
        trpcErrorCode: trpcCode,
        error: normalizeError(result.error),
      };

      log[trpcFailureLevel(trpcCode)](fields, "tRPC procedure failed.");
      return result;
    }

    log.info(
      {
        ...baseFields,
        event: "trpc_procedure_completed",
        durationMs,
      },
      "tRPC procedure completed.",
    );

    return result;
  } catch (error) {
    const trpcCode = trpcErrorCode(error);
    const fields = {
      ...baseFields,
      event: "trpc_procedure_failed",
      durationMs: Date.now() - started,
      trpcErrorCode: trpcCode,
      error: normalizeError(error),
    };

    log[trpcFailureLevel(trpcCode)](fields, "tRPC procedure failed.");
    throw error;
  }
});

const authMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const started = Date.now();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    logger.warn(
      {
        ...requestFields(ctx),
        component: "trpc",
        event: "trpc_auth_failed",
        procedurePath: path,
        procedureType: type,
        durationMs: Date.now() - started,
        trpcErrorCode: "UNAUTHORIZED",
      },
      "tRPC authorization failed.",
    );

    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unathorized",
    });
  }

  return next({ ctx: { ...ctx, auth: session } });
});

export const baseProcedure = t.procedure.use(trpcLoggingMiddleware);
export const protectedProcedure = t.procedure.use(authMiddleware).use(trpcLoggingMiddleware);

type QuotaSlotRunner = <T>(run: (tx: QuotaTx) => Promise<T>) => Promise<T>;

async function legacyPremiumGate(user: {
  id: string;
  email?: string;
}): Promise<unknown> {
  throwIfE2EFault("polar", "Simulated E2E Polar failure.");

  const customer = useMockedExternalServices
    ? createE2ECustomerState(user)
    : await observeExternalProvider(
        {
          component: "billing",
          provider: "polar",
          operation: "customers.getStateExternal",
          userId: user.id,
        },
        () =>
          polarClient.customers.getStateExternal({
            externalId: user.id,
          }),
      );

  if (
    !customer.activeSubscriptions ||
    customer.activeSubscriptions.length === 0
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Active subscription required",
    });
  }

  return customer;
}

const passthroughQuotaSlot: QuotaSlotRunner = (run) =>
  run(prisma as unknown as QuotaTx);

function createQuotaProcedure(feature: "workflow" | "credential") {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const result = await (async () => {
      if (!entitlementsActiveForUser(ctx.auth.user.id)) {
        const customer = await legacyPremiumGate(ctx.auth.user);
        return next({
          ctx: { ...ctx, customer, withQuotaSlot: passthroughQuotaSlot },
        });
      }

      const withQuotaSlot: QuotaSlotRunner = (run) =>
        runWithinStockQuota({ userId: ctx.auth.user.id, feature, run });

      return next({ ctx: { ...ctx, withQuotaSlot } });
    })();

    if (!result.ok) {
      const cause = (result.error as { cause?: unknown } | undefined)?.cause;
      const mapped = quotaTrpcError(cause ?? result.error);
      if (mapped) {
        throw mapped;
      }
    }

    return result;
  });
}

export const workflowQuotaProcedure = createQuotaProcedure("workflow");
export const credentialQuotaProcedure = createQuotaProcedure("credential");

export const planProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!entitlementsActiveForUser(ctx.auth.user.id)) {
    return next({ ctx: { ...ctx, plan: undefined } });
  }
  const plan = await getEffectivePlan(ctx.auth.user.id);
  return next({ ctx: { ...ctx, plan } });
});

export const premiumProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const customer = await legacyPremiumGate(ctx.auth.user);
    return next({ ctx: { ...ctx, customer } });
  },
);
