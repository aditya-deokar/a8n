"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { anthropicChannel } from "@/inngest/channels/anthropic";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type AnthropicToken = Realtime.Token<
  typeof anthropicChannel,
  ["status"]
>;

export async function fetchAnthropicRealtimeToken(): Promise<AnthropicToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: anthropicChannel(),
    topics: ["status"],
  });

  return token;
};
