"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { slackChannel } from "@/inngest/channels/slack";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type SlackToken = Realtime.Token<
  typeof slackChannel,
  ["status"]
>;

export async function fetchSlackRealtimeToken(): Promise<SlackToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: slackChannel(),
    topics: ["status"],
  });

  return token;
};
