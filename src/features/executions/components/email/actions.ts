"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { emailChannel } from "@/inngest/channels/email";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type EmailToken = Realtime.Token<
  typeof emailChannel,
  ["status"]
>;

export async function fetchEmailRealtimeToken(): Promise<EmailToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: emailChannel(),
    topics: ["status"],
  });

  return token;
};
