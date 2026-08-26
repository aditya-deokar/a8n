"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { openAiChannel } from "@/inngest/channels/openai";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type OpenAiToken = Realtime.Token<
  typeof openAiChannel,
  ["status"]
>;

export async function fetchOpenAiRealtimeToken(): Promise<OpenAiToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: openAiChannel(),
    topics: ["status"],
  });

  return token;
};
