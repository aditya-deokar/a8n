"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";
import { inngest } from "@/inngest/client";

export type ManualTriggerToken = Realtime.Token<
  typeof manualTriggerChannel,
  ["status"]
>;

export async function fetchManualTriggerRealtimeToken(): Promise<ManualTriggerToken> {
  try {
    const token = await getSubscriptionToken(inngest, {
      channel: manualTriggerChannel(),
      topics: ["status"],
    });

    return token;
  } catch (error) {
    console.error("Failed to fetch Inngest realtime token:", error);
    return null as any;
  }
};
