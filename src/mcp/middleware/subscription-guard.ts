import prisma from "@/lib/db";
import { polarClient } from "@/lib/polar";
import { entitlementsActiveForUser } from "@/config/plans";
import { runWithinStockQuota, type QuotaTx } from "@/lib/entitlements/consume";

/**
 * Shared MCP entitlement gate.
 *
 * With entitlements disabled (legacy mode) this performs the original
 * live-Polar subscription check. With entitlements enabled it is a no-op for
 * read/write surfaces whose quotas are enforced at their stock resources;
 * creation tools additionally wrap writes in {@link createWithinStockQuota}.
 */
export async function requireActiveSubscription(userId: string): Promise<void> {
  if (entitlementsActiveForUser(userId)) return;

  const customer = await polarClient.customers.getStateExternal({
    externalId: userId,
  });

  if (!customer.activeSubscriptions || customer.activeSubscriptions.length === 0) {
    throw new Error("Active subscription required");
  }
}

/**
 * Runs a stock-resource creation (workflow or credential) inside the same
 * race-safe quota transaction used by the app's tRPC procedures, keeping MCP
 * and app surfaces on one pool per user.
 */
export async function createWithinStockQuota<T>(params: {
  userId: string;
  feature: "workflow" | "credential";
  run: (tx: QuotaTx) => Promise<T>;
}): Promise<T> {
  if (!entitlementsActiveForUser(params.userId)) {
    await requireActiveSubscription(params.userId);
    return params.run(prisma as unknown as QuotaTx);
  }
  return runWithinStockQuota(params);
}
