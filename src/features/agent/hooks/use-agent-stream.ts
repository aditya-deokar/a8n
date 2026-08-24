"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentEvent } from "@/agent/api/events";
import type { ChatMessage, ToolActivity } from "../types";

// ─── Types ───────────────────────────────────────────────────

export interface QuotaExceededDetails {
  feature: string;
  used: number;
  limit: number;
  windowResetAt: string | null;
}

export interface UseAgentStreamOptions {
  /** The active thread ID. Streaming is disabled when null. */
  threadId: string | null;
  /** Called when the backend returns a draft preview (`draft.updated` with status "previewed"). */
  onDraftPreviewed?: (preview: any) => void;
  /** Called when a workflow is successfully applied (`workflow.applied` event). */
  onWorkflowApplied?: (workflowId: string) => void;
  /** Called when the backend blocks a message for safety reasons (AGENT_SAFETY_BLOCKED). */
  onSafetyBlocked?: (error: { code: string; message: string }) => void;
  /** Called when the monthly chat quota is exhausted (HTTP 402 from the runs endpoint). */
  onQuotaExceeded?: (details: QuotaExceededDetails) => void;
}

export interface UseAgentStreamReturn {
  /** Current chat messages (user + agent). */
  messages: ChatMessage[];
  /** Whether an agent run is currently in progress. */
  isLoading: boolean;
  /** Send a user message and start an SSE stream. */
  sendMessage: (text: string) => Promise<void>;
  /** Cancel the current agent run. */
  cancel: () => void;
  /** Update a specific message by ID with partial fields. */
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  /** Clear all messages. */
  clearMessages: () => void;
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * React hook that manages agent chat messages and SSE streaming.
 *
 * Extracted from the inline SSE streaming logic in
 * `src/features/editor/components/agent-sidebar.tsx` (lines 105–253).
 *
 * The hook owns the `messages` state and exposes `sendMessage` to
 * trigger a new agent run via `POST /api/agent/threads/:threadId/runs`.
 * Context-specific side effects (e.g. editor draft overlay, query
 * invalidation) are delegated to callbacks so the same hook works
 * in both the editor sidebar and the standalone chat page.
 */
export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for stable callback identity — avoids recreating sendMessage
  // on every render when the caller passes inline callback functions.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const isLoadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback(
    (id: string, updates: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const {
      threadId,
      onDraftPreviewed,
      onWorkflowApplied,
      onSafetyBlocked,
      onQuotaExceeded,
    } = optionsRef.current;

    if (!text.trim() || !threadId || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    const msgId = Date.now().toString();
    const abortController = new AbortController();
    abortRef.current = abortController;

    // Add user message and agent placeholder
    setMessages((prev) => [
      ...prev,
      { id: `user-${msgId}`, role: "user", text },
      {
        id: `agent-${msgId}`,
        role: "agent",
        text: "",
        isStreaming: true,
        toolActivity: [],
        runStatus: "started",
      },
    ]);

    try {
      const response = await fetch(`/api/agent/threads/${threadId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clientMessageId: msgId }),
        signal: abortController.signal,
      });

      // Handle non-SSE error responses (safety blocks, validation, quotas)
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ code: "UNKNOWN", message: "Agent request failed." }));

        if (errorData.code === "AGENT_SAFETY_BLOCKED") {
          onSafetyBlocked?.(errorData);
        }

        if (
          response.status === 402 &&
          (errorData.error === "QUOTA_EXCEEDED" ||
            errorData.code === "QUOTA_EXCEEDED")
        ) {
          const details: QuotaExceededDetails = {
            feature:
              typeof errorData.feature === "string"
                ? errorData.feature
                : "agent_chat",
            used: typeof errorData.used === "number" ? errorData.used : 0,
            limit: typeof errorData.limit === "number" ? errorData.limit : 0,
            windowResetAt:
              typeof errorData.windowResetAt === "string"
                ? errorData.windowResetAt
                : null,
          };
          onQuotaExceeded?.(details);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === `agent-${msgId}`
                ? {
                    ...m,
                    text: "",
                    isStreaming: false,
                    error: {
                      code: "QUOTA_EXCEEDED",
                      message: details.windowResetAt
                        ? `Monthly chat limit reached (${details.used}/${details.limit}). Resets ${new Date(details.windowResetAt).toLocaleDateString()}.`
                        : `Monthly chat limit reached (${details.used}/${details.limit}).`,
                    },
                    runStatus: "failed",
                  }
                : m,
            ),
          );
          isLoadingRef.current = false;
          setIsLoading(false);
          return;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === `agent-${msgId}`
              ? {
                  ...m,
                  text: "",
                  isStreaming: false,
                  error: { code: errorData.code, message: errorData.message },
                  runStatus: "failed",
                }
              : m,
          ),
        );
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let agentText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            // Handle SSE error events
            if (line.startsWith("event: error")) {
              continue; // The data line follows
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6)) as AgentEvent;

                switch (data.type) {
                  case "message.delta":
                    agentText += data.payload.text || "";
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === `agent-${msgId}`
                          ? { ...m, text: agentText }
                          : m,
                      ),
                    );
                    break;

                  case "tool.call.started":
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.id !== `agent-${msgId}`) return m;
                        const activity: ToolActivity = {
                          name: data.payload.toolName as string,
                          status: "running",
                          startedAt: Date.now(),
                        };
                        return {
                          ...m,
                          toolActivity: [...(m.toolActivity || []), activity],
                        };
                      }),
                    );
                    break;

                  case "tool.call.completed":
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.id !== `agent-${msgId}`) return m;
                        const updated = (m.toolActivity || []).map((ta) =>
                          ta.name === data.payload.toolName &&
                          ta.status === "running"
                            ? { ...ta, status: "completed" as const }
                            : ta,
                        );
                        return { ...m, toolActivity: updated };
                      }),
                    );
                    break;

                  case "approval.requested":
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === `agent-${msgId}`
                          ? {
                              ...m,
                              approvalId: data.payload.approvalId as string,
                            }
                          : m,
                      ),
                    );
                    break;

                  case "draft.updated":
                    if (
                      data.payload.status === "previewed" &&
                      data.payload.preview
                    ) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === `agent-${msgId}`
                            ? { ...m, preview: data.payload.preview }
                            : m,
                        ),
                      );
                      onDraftPreviewed?.(data.payload.preview);
                    }
                    break;

                  case "workflow.applied":
                    onWorkflowApplied?.(
                      data.payload.workflowId as string,
                    );
                    break;

                  case "run.completed":
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === `agent-${msgId}`
                          ? { ...m, runStatus: "completed" }
                          : m,
                      ),
                    );
                    break;

                  case "run.failed":
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === `agent-${msgId}`
                          ? {
                              ...m,
                              runStatus: "failed",
                              error: {
                                code:
                                  (data.payload.code as string) ||
                                  "AGENT_RUN_FAILED",
                                message:
                                  (data.payload.message as string) ||
                                  "The agent run failed.",
                              },
                            }
                          : m,
                      ),
                    );
                    break;

                  case "run.cancelled":
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === `agent-${msgId}`
                          ? { ...m, runStatus: "cancelled" }
                          : m,
                      ),
                    );
                    break;
                }
              } catch {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
      }
    } catch (err) {
      // Don't show error for intentional abort (cancel)
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `agent-${msgId}`
              ? { ...m, isStreaming: false, runStatus: "cancelled" }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `agent-${msgId}`
              ? {
                  ...m,
                  text: m.text + "\n*(Error communicating with agent)*",
                  runStatus: "failed",
                }
              : m,
          ),
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === `agent-${msgId}` ? { ...m, isStreaming: false } : m,
        ),
      );
      isLoadingRef.current = false;
      setIsLoading(false);
      abortRef.current = null;
    }
  }, []); // No deps — uses optionsRef for all external values

  return { messages, isLoading, sendMessage, cancel, updateMessage, clearMessages };
}
