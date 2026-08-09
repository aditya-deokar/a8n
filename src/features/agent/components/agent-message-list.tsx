"use client";

import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { Message, MessageContent, MessageAvatar } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Loader2Icon,
  SparklesIcon,
  ShieldAlertIcon,
  AlertTriangleIcon,
  CopyIcon,
  CheckCircle2Icon,
  UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import type { ChatMessage } from "@/features/agent/types";
import { AgentToolActivity } from "./agent-tool-activity";
import { AgentDraftPreview } from "./agent-draft-preview";
import { AgentApprovalCard } from "./agent-approval-card";
import "@/features/agent/styles/agent-chat.css";

// ─── Types ───────────────────────────────────────────────────

export interface AgentMessageListProps {
  messages: ChatMessage[];
  /** Called when the user approves a pending approval. */
  onApprove?: (approvalId: string, messageId: string) => void;
  /** Called when the user rejects a pending approval. */
  onReject?: (approvalId: string, messageId: string, reason?: string) => void;
  /** Called when the user clicks "View Draft" on a draft preview card. */
  onViewDraft?: (preview: any) => void;
  /** Whether approval actions are in-flight. */
  isApprovePending?: boolean;
  /** Workflow ID for deep-linking draft previews to the editor. */
  workflowId?: string | null;
}

// ─── Copy Button ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in insecure contexts
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 opacity-0 group-hover/msg:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title="Copy message"
    >
      {copied ? (
        <CheckCircle2Icon className="size-3 text-green-500" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </Button>
  );
}

// ─── Error Display ───────────────────────────────────────────

function MessageError({ error }: { error: NonNullable<ChatMessage["error"]> }) {
  const isSafety = error.code === "AGENT_SAFETY_BLOCKED";
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2.5 rounded-lg text-xs",
        isSafety
          ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50"
          : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50",
      )}
    >
      {isSafety ? (
        <ShieldAlertIcon className="size-3.5 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangleIcon className="size-3.5 mt-0.5 shrink-0" />
      )}
      <span>{error.message}</span>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-0.5">
      <div className="agent-typing-indicator">
        <span />
        <span />
        <span />
      </div>
      <span className="text-xs">Thinking...</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function AgentMessageList({
  messages,
  onApprove,
  onReject,
  onViewDraft,
  isApprovePending,
  workflowId,
}: AgentMessageListProps) {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="flex-1 w-full">
        <MessageScrollerViewport className="agent-messages-scroll">
          <MessageScrollerContent className="px-4 py-6 sm:px-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <Message
                  key={msg.id}
                  align={isUser ? "end" : "start"}
                  className="group/msg w-full agent-msg-enter"
                >
                  {/* Avatar */}
                  {!isUser && (
                    <MessageAvatar className="size-7 shrink-0 bg-gradient-to-br from-[#5c54a4]/20 to-[#9187ce]/20 ring-1 ring-[#5c54a4]/10">
                      <SparklesIcon className="size-3.5 text-[#5c54a4] dark:text-[#9187ce]" />
                    </MessageAvatar>
                  )}

                  <MessageContent>
                    <Bubble variant={isUser ? "default" : "muted"} className="max-w-[85%]">
                      <BubbleContent>
                        {/* Error display */}
                        {msg.error && <MessageError error={msg.error} />}

                        {/* Message text */}
                        {msg.text && (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.text}
                          </div>
                        )}

                        {/* Streaming indicators */}
                        {msg.isStreaming && !msg.text && !msg.error && (
                          <TypingIndicator />
                        )}
                        {msg.isStreaming && msg.text && (
                          <span className="agent-cursor inline-block ml-0.5">
                            ▍
                          </span>
                        )}
                      </BubbleContent>
                    </Bubble>

                    {/* Copy button for agent messages */}
                    {!isUser && msg.text && !msg.isStreaming && (
                      <div className="pl-1 -mt-1">
                        <CopyButton text={msg.text} />
                      </div>
                    )}

                    {/* Tool Activity — enhanced collapsible version */}
                    {msg.toolActivity && msg.toolActivity.length > 0 && (
                      <AgentToolActivity
                        activities={msg.toolActivity}
                        isStreaming={msg.isStreaming}
                      />
                    )}

                    {/* Draft Preview — enhanced version */}
                    {msg.preview && (
                      <AgentDraftPreview
                        preview={msg.preview}
                        workflowId={workflowId}
                        onOpenInEditor={() => onViewDraft?.(msg.preview)}
                      />
                    )}

                    {/* Approval Card — enhanced version with reject dialog */}
                    {msg.approvalId && (
                      <AgentApprovalCard
                        approvalId={msg.approvalId}
                        messageId={msg.id}
                        onApprove={(aId, mId) => onApprove?.(aId, mId)}
                        onReject={(aId, mId, reason) =>
                          onReject?.(aId, mId, reason)
                        }
                        isPending={isApprovePending}
                      />
                    )}

                    {/* Run cancelled notice */}
                    {msg.runStatus === "cancelled" && (
                      <div className="mt-1 text-[11px] text-muted-foreground italic pl-1">
                        Run was cancelled.
                      </div>
                    )}
                  </MessageContent>

                  {/* User avatar */}
                  {isUser && (
                    <MessageAvatar className="size-7 shrink-0 bg-muted ring-1 ring-border/50">
                      <UserIcon className="size-3.5 text-muted-foreground" />
                    </MessageAvatar>
                  )}
                </Message>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {/* Scroll-to-bottom button */}
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
