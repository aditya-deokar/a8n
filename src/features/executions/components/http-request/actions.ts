"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { inngest } from "@/inngest/client";
import { logger, normalizeError } from "@/lib/logging";
import { requireRealtimeTokenAccess } from "@/features/executions/hooks/realtime-auth";

export type HttpRequestToken = Realtime.Token<
  typeof httpRequestChannel,
  ["status"]
>;

export async function fetchHttpRequestRealtimeToken(): Promise<HttpRequestToken> {
  await requireRealtimeTokenAccess();
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
    throw error;
  }
};
