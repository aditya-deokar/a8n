"use client";

import { useRef, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendIcon, Loader2Icon, SquareIcon, WorkflowIcon, SparklesIcon, CalendarClockIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// ─── Types ───────────────────────────────────────────────────

export interface QuotaBannerData {
  used: number;
  limit: number;
  resetAt: string | null;
}

export interface AgentComposerProps {
  /** Current input text (controlled). */
  value: string;
  /** Input change handler. */
  onChange: (value: string) => void;
  /** Called when the user submits a message. */
  onSubmit: (text: string) => void;
  /** Called when the user clicks the stop button. */
  onCancel?: () => void;
  /** Whether the agent is currently running. */
  isLoading: boolean;
  /** Whether the composer is fully disabled (e.g. no thread). */
  disabled?: boolean;
  /** Name of the attached workflow, if any. */
  workflowName?: string | null;
  /** Shown when the monthly chat quota is exhausted (HTTP 402). */
  quotaNotice?: QuotaBannerData | null;
}

const MAX_CHARS = 20_000;

// ─── Component ───────────────────────────────────────────────

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  isLoading,
  disabled = false,
  workflowName,
  quotaNotice,
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!value.trim() || isLoading || disabled) return;
      onSubmit(value.trim());
    },
    [value, isLoading, disabled, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="border-t border-border/60 bg-background/80 backdrop-blur-sm px-4 py-3 sm:px-6">
      {/* Monthly quota banner */}
      {quotaNotice && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
          <CalendarClockIcon className="size-3.5 shrink-0" />
          <span>
            <span className="font-medium">
              {quotaNotice.used}/{quotaNotice.limit} chats used
            </span>
            {quotaNotice.resetAt && (
              <>
                {" — resets "}
                {new Date(quotaNotice.resetAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => authClient.checkout({ slug: "pro" })}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#5c54a4] px-2.5 py-1 font-medium text-white transition-opacity hover:opacity-90"
          >
            <SparklesIcon className="size-3" />
            Upgrade for 500/mo
          </button>
        </div>
      )}

      {/* Workflow context badge */}
      {workflowName && (
        <div className="flex items-center gap-1.5 mb-2">
          <WorkflowIcon className="size-3 text-[#5c54a4]" />
          <span className="text-[11px] text-muted-foreground">
            Working with <span className="font-medium text-foreground">{workflowName}</span>
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="relative flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Starting conversation..."
                : "Ask the agent to build, explain, or debug workflows..."
            }
            disabled={isLoading || disabled}
            rows={1}
            className="min-h-[44px] max-h-[160px] resize-none pr-3 text-sm rounded-xl border-border/60 bg-muted/30 focus:bg-background transition-colors"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
        </div>

        {/* Send / Stop button */}
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onCancel}
            className="size-[44px] shrink-0 rounded-xl border-red-200 dark:border-red-800/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
            title="Stop agent"
          >
            <SquareIcon className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim() || disabled || isOverLimit}
            className="size-[44px] shrink-0 rounded-xl bg-gradient-to-b from-[#5c54a4] to-[#9187ce] hover:opacity-90 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset] border-0 transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
          >
            <SendIcon className="size-4" />
          </Button>
        )}
      </form>

      {/* Footer info */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <span className="text-[10px] text-muted-foreground">
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-[#5c54a4] dark:text-[#9187ce] animate-pulse">
              <Loader2Icon className="size-2.5 animate-spin" />
              Agent is working...
            </span>
          ) : (
            <span>
              <kbd className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded">Enter</kbd>
              {" to send, "}
              <kbd className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded">Shift+Enter</kbd>
              {" for newline"}
            </span>
          )}
        </span>
        {charCount > 0 && (
          <span
            className={`text-[10px] tabular-nums ${
              isOverLimit
                ? "text-red-500 font-medium"
                : charCount > MAX_CHARS * 0.9
                  ? "text-amber-500"
                  : "text-muted-foreground"
            }`}
          >
            {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
