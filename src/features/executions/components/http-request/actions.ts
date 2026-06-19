"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { inngest } from "@/inngest/client";

export type HttpRequestToken = Realtime.Token<
  typeof httpRequestChannel,
  ["status"]
>;

export async function fetchHttpRequestRealtimeToken(): Promise<HttpRequestToken> {
  try {
    const token = await getSubscriptionToken(inngest, {
      channel: httpRequestChannel(),
      topics: ["status"],
    });

    return token;
  } catch (error) {
    console.error("Failed to fetch Inngest realtime token:", error);
    return null as any;
  }
};
