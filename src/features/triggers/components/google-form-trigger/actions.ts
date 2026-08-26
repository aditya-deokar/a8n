"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { googleFormTriggerChannel } from "@/inngest/channels/google-form-trigger";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type GoogleFormTriggerToken = Realtime.Token<
  typeof googleFormTriggerChannel,
  ["status"]
>;

export async function fetchGoogleFormTriggerRealtimeToken(): Promise<GoogleFormTriggerToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: googleFormTriggerChannel(),
    topics: ["status"],
  });

  return token;
};
