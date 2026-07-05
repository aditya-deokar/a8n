"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { inngest } from "@/inngest/client";
import { logger, normalizeError } from "@/lib/logging";

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
    logger.error(
      {
        component: "workflow",
        event: "external_provider_request_failed",
        provider: "inngest",
        operation: "get_realtime_subscription_token",
        channel: "http-request",
        error: normalizeError(error),
      },
      "Failed to fetch Inngest realtime token.",
    );
    return null as unknown as HttpRequestToken;
  }
};
