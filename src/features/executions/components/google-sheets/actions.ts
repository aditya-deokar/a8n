"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { googleSheetsChannel } from "@/inngest/channels/google-sheets";
import { inngest } from "@/inngest/client";

export type GoogleSheetsToken = Realtime.Token<
  typeof googleSheetsChannel,
  ["status"]
>;

export async function fetchGoogleSheetsRealtimeToken(): Promise<GoogleSheetsToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: googleSheetsChannel(),
    topics: ["status"],
  });

  return token;
};
