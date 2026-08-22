"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

/**
 * Single source for every usage meter in the UI. Refreshes on a short
 * staleness window and on window focus so counters stay honest without
 * hammering the endpoint. Consumers should render nothing while loading and
 * degrade silently on error — meters are cosmetic, never load-bearing.
 */
export function useEntitlementSnapshot() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.subscriptions.getSnapshot.queryOptions(undefined, {
      staleTime: 30_000,
    }),
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });
}
