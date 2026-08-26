"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { googleSheetsChannel } from "@/inngest/channels/google-sheets";
import { inngest } from "@/inngest/client";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type GoogleSheetsToken = Realtime.Token<
  typeof googleSheetsChannel,
  ["status"]
>;

export async function fetchGoogleSheetsRealtimeToken(): Promise<GoogleSheetsToken> {
  await requireRealtimeTokenAccess();
  const token = await getSubscriptionToken(inngest, {
    channel: googleSheetsChannel(),
    topics: ["status"],
  });

  return token;
};
