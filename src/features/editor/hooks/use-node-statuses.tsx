"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { atom, useAtomValue, useSetAtom } from "jotai";
import type { Realtime } from "@inngest/realtime";
import type { NodeStatus } from "@/components/react-flow/node-status-indicator";
import { HTTP_REQUEST_CHANNEL_NAME } from "@/inngest/channels/http-request";
import { MANUAL_TRIGGER_CHANNEL_NAME } from "@/inngest/channels/manual-trigger";
import { GOOGLE_FORM_TRIGGER_CHANNEL_NAME } from "@/inngest/channels/google-form-trigger";
import { STRIPE_TRIGGER_CHANNEL_NAME } from "@/inngest/channels/stripe-trigger";
import { GEMINI_CHANNEL_NAME } from "@/inngest/channels/gemini";
import { OPENAI_CHANNEL_NAME } from "@/inngest/channels/openai";
import { ANTHROPIC_CHANNEL_NAME } from "@/inngest/channels/anthropic";
import { DISCORD_CHANNEL_NAME } from "@/inngest/channels/discord";
import { SLACK_CHANNEL_NAME } from "@/inngest/channels/slack";
import { EMAIL_CHANNEL_NAME } from "@/inngest/channels/email";
import { GOOGLE_SHEETS_CHANNEL_NAME } from "@/inngest/channels/google-sheets";
import { fetchHttpRequestRealtimeToken } from "@/features/executions/components/http-request/actions";
import { fetchManualTriggerRealtimeToken } from "@/features/triggers/components/manual-trigger/actions";
import { fetchGoogleFormTriggerRealtimeToken } from "@/features/triggers/components/google-form-trigger/actions";
import { fetchStripeTriggerRealtimeToken } from "@/features/triggers/components/stripe-trigger/actions";
import { fetchGeminiRealtimeToken } from "@/features/executions/components/gemini/actions";
import { fetchOpenAiRealtimeToken } from "@/features/executions/components/openai/actions";
import { fetchAnthropicRealtimeToken } from "@/features/executions/components/anthropic/actions";
import { fetchDiscordRealtimeToken } from "@/features/executions/components/discord/actions";
import { fetchSlackRealtimeToken } from "@/features/executions/components/slack/actions";
import { fetchEmailRealtimeToken } from "@/features/executions/components/email/actions";
import { fetchGoogleSheetsRealtimeToken } from "@/features/executions/components/google-sheets/actions";
import { editorNodesAtom } from "../store/atoms";

// nodeId -> latest status, fed by ONE subscription per node type present on
// the canvas (instead of one SSE stream per node).
export const nodeStatusesAtom = atom<Record<string, NodeStatus>>({});

export function useNodeStatusById(nodeId: string): NodeStatus {
  const statuses = useAtomValue(nodeStatusesAtom);
  return statuses[nodeId] ?? "initial";
}

interface ChannelConfig {
  channelName: string;
  topic: string;
  refreshToken: () => Promise<Realtime.Subscribe.Token>;
}

const STATUS_CHANNELS: Record<string, ChannelConfig> = {
  MANUAL_TRIGGER: {
    channelName: MANUAL_TRIGGER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchManualTriggerRealtimeToken,
  },
  GOOGLE_FORM_TRIGGER: {
    channelName: GOOGLE_FORM_TRIGGER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchGoogleFormTriggerRealtimeToken,
  },
  STRIPE_TRIGGER: {
    channelName: STRIPE_TRIGGER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchStripeTriggerRealtimeToken,
  },
  HTTP_REQUEST: {
    channelName: HTTP_REQUEST_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchHttpRequestRealtimeToken,
  },
  OPENAI: {
    channelName: OPENAI_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchOpenAiRealtimeToken,
  },
  ANTHROPIC: {
    channelName: ANTHROPIC_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchAnthropicRealtimeToken,
  },
  GEMINI: {
    channelName: GEMINI_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchGeminiRealtimeToken,
  },
  DISCORD: {
    channelName: DISCORD_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchDiscordRealtimeToken,
  },
  SLACK: {
    channelName: SLACK_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchSlackRealtimeToken,
  },
  EMAIL: {
    channelName: EMAIL_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchEmailRealtimeToken,
  },
  GOOGLE_SHEETS: {
    channelName: GOOGLE_SHEETS_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchGoogleSheetsRealtimeToken,
  },
};

type StatusMessage = {
  kind: string;
  channel?: string;
  topic?: string;
  data?: { nodeId?: unknown; status?: unknown };
  createdAt?: string | Date;
};

function ChannelListener({ config }: { config: ChannelConfig }) {
  const { data } = useInngestSubscription({
    refreshToken: config.refreshToken,
    enabled: true,
  });
  const setStatuses = useSetAtom(nodeStatusesAtom);

  useEffect(() => {
    if (!data?.length) return;

    setStatuses((previous) => {
      let next: Record<string, NodeStatus> = previous;
      for (const rawMessage of data as StatusMessage[]) {
        if (
          rawMessage.kind !== "data" ||
          rawMessage.channel !== config.channelName ||
          rawMessage.topic !== config.topic
        ) {
          continue;
        }
        const nodeId = rawMessage.data?.nodeId;
        const status = rawMessage.data?.status;
        if (typeof nodeId !== "string") continue;
        if (status !== "loading" && status !== "success" && status !== "error" && status !== "initial") {
          continue;
        }
        if (next[nodeId] === status) continue;
        if (next === previous) next = { ...previous };
        next[nodeId] = status;
      }
      return next;
    });
  }, [data, config.channelName, config.topic, setStatuses]);

  return null;
}

/**
 * Mounts one realtime subscription per distinct node type on the canvas and
 * funnels every message into a shared status store.
 */
export function RealtimeStatusProvider({ children }: { children: ReactNode }) {
  const nodes = useAtomValue(editorNodesAtom);

  const activeConfigs = useMemo(() => {
    const types = new Set<string>();
    for (const node of nodes) {
      const type = String(node.type ?? "");
      if (type !== "INITIAL" && STATUS_CHANNELS[type]) types.add(type);
    }
    return [...types].map((type) => ({ key: type, config: STATUS_CHANNELS[type] }));
  }, [nodes]);

  return (
    <>
      {activeConfigs.map(({ key, config }) => (
        <ChannelListener key={key} config={config} />
      ))}
      {children}
    </>
  );
}
