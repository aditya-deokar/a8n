import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { polarClient } from "@/lib/polar";
import { isE2EMode } from "@/lib/e2e-safety";
import { throwIfE2EFault } from "@/lib/e2e-faults";
import { observeExternalProvider } from "@/lib/logging";
import { entitlementSnapshot } from "@/lib/entitlements/snapshot";
import { applyCustomerState, type ApplyResult } from "@/lib/entitlements/sync";

const SYNC_RATE_LIMIT_PER_HOUR = 3;
const SYNC_WINDOW_MS = 60 * 60 * 1000;
const SYNC_ATTEMPTS_MAX_TRACKED = 1_000;

const syncAttempts = new Map<string, number[]>();

function allowSync(userId: string): boolean {
  if (syncAttempts.size > SYNC_ATTEMPTS_MAX_TRACKED) {
    syncAttempts.clear();
  }

  const now = Date.now();
  const recent = (syncAttempts.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < SYNC_WINDOW_MS,
  );

  if (recent.length >= SYNC_RATE_LIMIT_PER_HOUR) {
    syncAttempts.set(userId, recent);
    return false;
  }

  recent.push(now);
  syncAttempts.set(userId, recent);
  return true;
}

function mockedCustomerState(user: { id: string; email?: string }) {
  const identity = `${user.id} ${user.email ?? ""}`.toLowerCase();
  const active =
    identity.includes("pro")
      ? [
          {
            id: "e2e_subscription_pro",
            status: "active",
            product: { id: "pro" },
            customer: { externalId: user.id },
          },
        ]
      : [];
  return { activeSubscriptions: active };
}

export const subscriptionsRouter = createTRPCRouter({
  getSnapshot: protectedProcedure.query(({ ctx }) =>
    entitlementSnapshot(ctx.auth.user.id),
  ),

  syncNow: protectedProcedure.mutation(async ({ ctx }): Promise<{
    synced: boolean;
    reason: string | null;
    snapshot: Awaited<ReturnType<typeof entitlementSnapshot>>;
  }> => {
    throwIfE2EFault("polar", "Simulated E2E Polar failure.");

    if (!allowSync(ctx.auth.user.id)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many subscription sync attempts. Try again later.",
      });
    }

    let result: ApplyResult;
    if (isE2EMode() && process.env.E2E_EXTERNAL_SERVICES === "mock") {
      result = await applyCustomerState(
        mockedCustomerState({
          id: ctx.auth.user.id,
          email: ctx.auth.user.email,
        }),
      );
    } else {
      const state = await observeExternalProvider(
        {
          component: "billing",
          provider: "polar",
          operation: "customers.getStateExternal",
          userId: ctx.auth.user.id,
        },
        () =>
          polarClient.customers.getStateExternal({
            externalId: ctx.auth.user.id,
          }),
      );
      result = await applyCustomerState(state);
    }

    return {
      synced: result.applied,
      reason: result.reason ?? null,
      snapshot: await entitlementSnapshot(ctx.auth.user.id),
    };
  }),
});
