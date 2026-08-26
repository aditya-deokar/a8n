"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { discordChannel } from "@/inngest/channels/discord";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type DiscordToken = Realtime.Token<
  typeof discordChannel,
  ["status"]
>;

export async function fetchDiscordRealtimeToken(): Promise<DiscordToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: discordChannel(),
    topics: ["status"],
  });

  return token;
};
