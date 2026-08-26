"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";
import { inngest } from "@/inngest/client";
import { logger, normalizeError } from "@/lib/logging";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type ManualTriggerToken = Realtime.Token<
  typeof manualTriggerChannel,
  ["status"]
>;

export async function fetchManualTriggerRealtimeToken(): Promise<ManualTriggerToken> {
  await requireRealtimeTokenAccess();
  try {
    const token = await getSubscriptionToken(inngest, {
      channel: manualTriggerChannel(),
      topics: ["status"],
    });

    return token;
  } catch (error) {
    logger.error(
      {
        component: "workflow",
        event: "external_provider_request_failed",
        provider: "inngest",
        operation: "get_realtime_subscription_token",
        channel: "manual-trigger",
        error: normalizeError(error),
      },
      "Failed to fetch Inngest realtime token.",
    );
    throw error;
  }
};
