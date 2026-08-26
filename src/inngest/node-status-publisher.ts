import { inngest } from "./client";
import { CHANNEL_BY_NODE_TYPE } from "./channels/registry";
import type { NodeType } from "@/generated/prisma";

type LegacyInngestApi = {
  inngestApi: {
    publish: (
      options: {
        topics: string[];
        channel: string;
        runId?: string;
      },
      data: unknown,
    ) => Promise<{ ok: boolean }>;
  };
};

/**
 * Publishes a node status message from contexts that cannot use the
 * realtime middleware's `publish` (e.g. the onFailure handler, which runs
 * outside the function body). The main execution path uses `ctx.publish`.
 */
export async function publishNodeStatus(options: {
  eventId: string;
  nodeType: NodeType;
  nodeId: string;
  status: "loading" | "success" | "error";
}): Promise<void> {
  const channel = CHANNEL_BY_NODE_TYPE[options.nodeType];
  if (!channel) return;

  const resolved = await Promise.resolve(
    channel().status({
      nodeId: options.nodeId,
      status: options.status,
    }),
  ) as { topic: string; channel: string; data: unknown };

  const { topic, channel: channelName, data } = resolved;

  try {
    const result = await (inngest as unknown as LegacyInngestApi).inngestApi.publish(
      {
        topics: [topic],
        channel: channelName,
        runId: options.eventId,
      },
      data,
    );
    if (!result?.ok) {
      // Best-effort only — never let status publishing mask the real failure.
    }
  } catch {
    // Swallow: failure-path publishing must not throw.
  }
}
