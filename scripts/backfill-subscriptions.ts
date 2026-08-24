/**
 * One-time idempotent backfill: mirrors every known Polar customer into the
 * local Subscription table so existing subscribers resolve to Pro immediately
 * after deploy (before their next webhook arrives).
 *
 * Run:
 *   pnpm exec tsx scripts/backfill-subscriptions.ts
 */

import "dotenv/config";
import prisma from "../src/lib/db";
import { polarClient } from "../src/lib/polar";
import { applyCustomerState } from "../src/lib/entitlements/sync";

interface PolarCustomerLike {
  id?: string;
  email?: string;
  externalId?: string | null;
}

async function fetchCustomerPage(params: {
  limit: number;
  page?: number;
}): Promise<PolarCustomerLike[]> {
  const response = await polarClient.customers.list({
    limit: params.limit,
    ...(params.page ? { page: params.page } : {}),
  });

  const payload = response as unknown as {
    result?: { items?: PolarCustomerLike[] };
    items?: PolarCustomerLike[];
  };

  return payload.result?.items ?? payload.items ?? [];
}

async function main() {
  const pageSize = 100;
  let page = 1;
  let scanned = 0;
  let linked = 0;
  let unlinked = 0;
  let failed = 0;

  console.log("Starting subscription backfill from Polar…");

  while (true) {
    let customers: PolarCustomerLike[];
    try {
      customers = await fetchCustomerPage({ limit: pageSize, page });
    } catch (error) {
      console.error(`Failed to fetch customers page ${page}:`, error);
      process.exitCode = 1;
      break;
    }

    if (customers.length === 0) break;

    for (const customer of customers) {
      scanned += 1;

      if (!customer.externalId) {
        unlinked += 1;
        console.warn(
          `Skipping customer ${customer.id ?? "<no-id>"} (${customer.email ?? "no-email"}): no externalId.`,
        );
        continue;
      }

      try {
        const state = await polarClient.customers.getStateExternal({
          externalId: customer.externalId,
        });
        await applyCustomerState(state);
        linked += 1;
        console.log(
          `Mirrored customer ${customer.email ?? customer.id} -> user ${customer.externalId}`,
        );
      } catch (error) {
        failed += 1;
        console.error(
          `Failed to mirror customer ${customer.externalId}:`,
          error,
        );
      }
    }

    if (customers.length < pageSize) break;
    page += 1;
  }

  const remaining = await prisma.subscription.count();

  console.log("Backfill complete.", {
    scanned,
    linked,
    unlinked,
    failed,
    subscriptionsInDb: remaining,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Backfill crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
