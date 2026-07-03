import { auth } from '@/lib/auth';
import { polarClient } from '@/lib/polar';
import { initTRPC, TRPCError } from '@trpc/server';
import { headers } from 'next/headers';
import { cache } from 'react';
import superjson from "superjson"
import { isE2EMode } from '@/lib/e2e-safety';
import { throwIfE2EFault } from '@/lib/e2e-faults';

const useMockedExternalServices =
  isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock";

function createE2ECustomerState(user: { id?: string; email?: string }) {
  const identity = `${user.id ?? ""} ${user.email ?? ""}`.toLowerCase();
  const activeSubscriptions = identity.includes("pro")
    ? [{ id: "e2e_subscription_pro", status: "active" }]
    : [];

  return { activeSubscriptions };
}

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
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
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unathorized",
    });
  }

  return next({ ctx: { ...ctx, auth: session } });
});
export const premiumProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    throwIfE2EFault("polar", "Simulated E2E Polar failure.");

    const customer = useMockedExternalServices
      ? createE2ECustomerState(ctx.auth.user)
      : await polarClient.customers.getStateExternal({
          externalId: ctx.auth.user.id,
        });

    if (
      !customer.activeSubscriptions ||
      customer.activeSubscriptions.length === 0
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Active subscription required",
      });
    }

    return next({ ctx: { ...ctx, customer } });
  },
);
