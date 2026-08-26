import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logger, normalizeError } from "@/lib/logging";

/**
 * Server actions minting Inngest realtime subscription tokens must be
 * authenticated — without this guard anyone who can invoke the action could
 * subscribe to the platform-wide node-status channels.
 */
export async function requireRealtimeTokenAccess(): Promise<void> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    logger.warn(
      {
        component: "workflow",
        event: "realtime_token_unauthorized",
      },
      "Unauthenticated request for an Inngest realtime subscription token.",
    );
    throw new Error("Unauthorized");
  }
}

export function logRealtimeTokenFailure(error: unknown, channel: string): void {
  logger.error(
    {
      component: "workflow",
      event: "external_provider_request_failed",
      provider: "inngest",
      operation: "get_realtime_subscription_token",
      channel,
      error: normalizeError(error),
    },
    "Failed to fetch Inngest realtime token.",
  );
}
