"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlusIcon,
  MessageSquareIcon,
  Loader2Icon,
  ArchiveIcon,
  WorkflowIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentThreads, useCreateAgentThread, useArchiveAgentThread } from "@/features/agent/hooks/use-agent-thread";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────

export interface AgentThreadListProps {
  /** Currently active thread ID. */
  activeThreadId: string | null;
  /** Called when the user selects a thread. */
  onSelectThread: (threadId: string) => void;
  /** Called when a new thread is created (returns the new thread ID). */
  onNewThread: (threadId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(date: string | null): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────

export function AgentThreadList({
  activeThreadId,
  onSelectThread,
  onNewThread,
}: AgentThreadListProps) {
  const [search, setSearch] = useState("");
  const threadsQuery = useAgentThreads();
  const createThread = useCreateAgentThread();
  const archiveThread = useArchiveAgentThread();

  const threads = threadsQuery.data ?? [];
  const filteredThreads = search
    ? threads.filter(
        (t: any) =>
          (t.title ?? "New conversation").toLowerCase().includes(search.toLowerCase()),
      )
    : threads;

  const handleNewThread = async () => {
    createThread.mutate(
      {},
      {
        onSuccess: (data) => {
          onNewThread(data.id);
        },
      },
    );
  };

  const handleArchive = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    archiveThread.mutate({ threadId });
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="p-3 space-y-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Threads</h3>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-[#5c54a4] hover:text-[#5c54a4] hover:bg-[#5c54a4]/10"
            onClick={handleNewThread}
            disabled={createThread.isPending}
          >
            {createThread.isPending ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <PlusIcon className="size-3" />
            )}
            New Chat
          </Button>
        </div>

        {/* Search */}
        {threads.length > 5 && (
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads..."
              className="h-7 pl-8 text-xs rounded-lg bg-background/50"
            />
          </div>
        )}
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-0.5">
          {threadsQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!threadsQuery.isLoading && filteredThreads.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
              <MessageSquareIcon className="size-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {search ? "No matching threads" : "No conversations yet"}
              </p>
              {!search && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-1"
                  onClick={handleNewThread}
                  disabled={createThread.isPending}
                >
                  Start a conversation
                </Button>
              )}
            </div>
          )}

          {filteredThreads.map((thread: any) => {
            const isActive = thread.id === activeThreadId;
            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "group w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                  isActive
                    ? "bg-background shadow-sm border border-border/60 ring-1 ring-[#5c54a4]/10"
                    : "hover:bg-background/60 border border-transparent",
                )}
              >
                <MessageSquareIcon
                  className={cn(
                    "size-3.5 mt-0.5 shrink-0",
                    isActive ? "text-[#5c54a4]" : "text-muted-foreground/60",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-xs font-medium truncate",
                        isActive ? "text-foreground" : "text-foreground/80",
                      )}
                    >
                      {thread.title || "New conversation"}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatRelativeTime(thread.lastMessageAt || thread.createdAt)}
                    </span>
                  </div>
                  {thread.workflowId && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <WorkflowIcon className="size-2.5 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground truncate">
                        Workflow attached
                      </span>
                    </div>
                  )}
                </div>

                {/* Archive action */}
                <button
                  onClick={(e) => handleArchive(thread.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                  title="Archive thread"
                >
                  <ArchiveIcon className="size-3" />
                </button>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
