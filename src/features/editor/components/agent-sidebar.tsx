"use client";

import { useEffect, useState, useRef, useCallback, type FormEvent } from "react";
import { useTRPC } from "@/trpc/client";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { isAgentSidebarOpenAtom, graphModeAtom, isCanvasDirtyAtom, draftPreviewAtom } from "../store/atoms";
import { 
  MessageScrollerProvider, 
  MessageScroller, 
  MessageScrollerViewport, 
  MessageScrollerContent 
} from "@/components/ui/message-scroller";
import { Message } from "@/components/ui/message";
import { Bubble } from "@/components/ui/bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Loader2Icon, SendIcon, XIcon, CheckIcon, WrenchIcon, 
  AlertTriangleIcon, BrainIcon, ArrowLeftIcon, SparklesIcon,
  ShieldAlertIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AgentMemoryPanel } from "./agent-memory-panel";
import { useAgentStream } from "@/features/agent/hooks/use-agent-stream";
import { useAgentApprovals } from "@/features/agent/hooks/use-agent-approvals";
import { useEnsureAgentThread } from "@/features/agent/hooks/use-agent-thread";


type SidebarView = "chat" | "memory";

// ─── Component ───────────────────────────────────────────────

export function AgentSidebar({ workflowId }: { workflowId: string }) {
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useAtom(isAgentSidebarOpenAtom);
  const setGraphMode = useSetAtom(graphModeAtom);
  const setDraftPreview = useSetAtom(draftPreviewAtom);
  const graphMode = useAtomValue(graphModeAtom);
  const isCanvasDirty = useAtomValue(isCanvasDirtyAtom);
  const queryClient = useQueryClient();
  
  const [threadId, setThreadId] = useState<string | null>(null);
  const [view, setView] = useState<SidebarView>("chat");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Shared hooks ───

  const ensureThread = useEnsureAgentThread();

  const { messages, isLoading, sendMessage, updateMessage } = useAgentStream({
    threadId,
    onDraftPreviewed: (preview) => {
      setDraftPreview(preview as { nodes?: any[], edges?: any[] });
      setGraphMode("draft");
    },
    onWorkflowApplied: () => {
      setGraphMode("applied");
      queryClient.invalidateQueries(trpc.workflows.getOne.queryOptions({ id: workflowId }));
      toast.success("Agent changes applied successfully!");
      setTimeout(() => setGraphMode("live"), 2000);
    },
    onSafetyBlocked: (error) => {
      toast.error("Message blocked by safety policy", {
        description: error.message,
        icon: <ShieldAlertIcon className="size-4" />,
      });
    },
  });

  const { approve, reject } = useAgentApprovals({
    onBeforeApprove: () => {
      if (isCanvasDirty) {
        toast.error("You have unsaved changes on the canvas. Please save them before applying a draft.");
        return false;
      }
      return true;
    },
  });

  // ─── Thread lifecycle ───

  // Load thread on mount
  useEffect(() => {
    ensureThread.mutate({ workflowId }, {
      onSuccess: (data) => setThreadId(data.id),
    });
  }, [workflowId]);

  // ─── Keyboard shortcut ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setIsOpen]);

  // Auto-focus input when sidebar opens
  useEffect(() => {
    if (isOpen && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, view]);

  // ─── Handlers ───

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleApprove = async (approvalId: string, messageId: string) => {
    const success = await approve(approvalId);
    if (success) {
      updateMessage(messageId, { approvalId: undefined });
    }
  };

  const handleReject = async (approvalId: string, messageId: string) => {
    const success = await reject(approvalId, "User rejected from UI");
    if (success) {
      updateMessage(messageId, { approvalId: undefined });
    }
  };

  const handleBackToLive = useCallback(() => {
    setGraphMode("live");
    setDraftPreview(null);
  }, [setGraphMode, setDraftPreview]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-transparent">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Agent Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant={view === "memory" ? "secondary" : "ghost"} 
            size="icon" 
            className="size-8"
            onClick={() => setView(view === "memory" ? "chat" : "memory")}
            title="Agent Memory"
          >
            <BrainIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Draft Mode Banner ─── */}
      {graphMode === "draft" && view === "chat" && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-primary/20">
          <span className="text-xs font-medium text-primary">Viewing Draft Preview</span>
          <Button 
            variant="ghost" size="sm" 
            className="h-6 text-xs text-primary hover:text-primary/80 px-2"
            onClick={handleBackToLive}
          >
            <ArrowLeftIcon className="size-3 mr-1" />
            Back to Live
          </Button>
        </div>
      )}

      {/* ─── Views ─── */}
      {view === "memory" ? (
        <AgentMemoryPanel />
      ) : (
        <>
          {/* ─── Message Area ─── */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <MessageScrollerProvider>
              <MessageScroller className="flex-1 w-full">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-4 flex flex-col gap-4">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center mt-16 gap-3 text-center px-4">
                        <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <SparklesIcon className="size-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-foreground">How can I help?</p>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          I can build, modify, explain, and diagnose your workflows. Try asking me to create something!
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                          {["Build a workflow", "Explain this workflow", "Add error handling"].map(suggestion => (
                            <button
                              key={suggestion}
                              onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                              className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map(msg => (
                      <Message key={msg.id} role={msg.role} className="w-full">
                        <Bubble className="text-sm w-fit max-w-[90%]">
                          {/* Error display */}
                          {msg.error && (
                            <div className={cn(
                              "flex items-start gap-2 p-2.5 rounded-lg mb-2 text-xs",
                              msg.error.code === "AGENT_SAFETY_BLOCKED"
                                ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50"
                                : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                            )}>
                              {msg.error.code === "AGENT_SAFETY_BLOCKED" 
                                ? <ShieldAlertIcon className="size-3.5 mt-0.5 shrink-0" />
                                : <AlertTriangleIcon className="size-3.5 mt-0.5 shrink-0" />
                              }
                              <span>{msg.error.message}</span>
                            </div>
                          )}

                          {/* Message text */}
                          {msg.text && (
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                          )}

                          {/* Streaming indicator */}
                          {msg.isStreaming && !msg.text && !msg.error && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2Icon className="size-3 animate-spin" />
                              <span className="text-xs">Thinking...</span>
                            </div>
                          )}
                          {msg.isStreaming && msg.text && (
                            <span className="animate-pulse inline-block ml-1">▍</span>
                          )}
                        </Bubble>

                        {/* ─── Tool Activity Feed ─── */}
                        {msg.toolActivity && msg.toolActivity.length > 0 && (
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            {msg.toolActivity.map((ta, i) => (
                              <div key={`${ta.name}-${i}`} className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                                {ta.status === "running" ? (
                                  <Loader2Icon className="size-2.5 animate-spin text-primary" />
                                ) : ta.status === "completed" ? (
                                  <CheckIcon className="size-2.5 text-green-500" />
                                ) : (
                                  <AlertTriangleIcon className="size-2.5 text-red-500" />
                                )}
                                <WrenchIcon className="size-2.5 opacity-50" />
                                <span className="font-mono">{ta.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                
                        {/* ─── Draft Preview Card ─── */}
                        {msg.preview && (
                          <div className="mt-2 w-[250px]">
                            <Card className="shadow-none bg-muted/50">
                              <CardHeader className="p-3 pb-0">
                                <CardTitle className="text-xs">Draft Preview Available</CardTitle>
                                <CardDescription className="text-[10px]">The graph canvas is now showing a preview of this draft.</CardDescription>
                              </CardHeader>
                              <CardContent className="p-3">
                                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setGraphMode("draft")}>
                                  View Draft Again
                                </Button>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* ─── Approval Card ─── */}
                        {msg.approvalId && (
                          <div className="mt-2 w-[250px]">
                            <Card className="border-primary/20 bg-primary/5 shadow-none">
                              <CardHeader className="p-3 pb-0">
                                <CardTitle className="text-xs">Approval Required</CardTitle>
                                <CardDescription className="text-[10px]">Apply these changes to your live workflow?</CardDescription>
                              </CardHeader>
                              <CardFooter className="p-3 flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => handleReject(msg.approvalId!, msg.id)}>
                                  Reject
                                </Button>
                                <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleApprove(msg.approvalId!, msg.id)}>
                                  Approve
                                </Button>
                              </CardFooter>
                            </Card>
                          </div>
                        )}

                        {/* ─── Run Status ─── */}
                        {msg.runStatus === "cancelled" && (
                          <div className="mt-1 text-[10px] text-muted-foreground italic px-1">Run was cancelled.</div>
                        )}
                      </Message>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* ─── Input ─── */}
          <div className="p-4 bg-background border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input 
                ref={inputRef}
                value={input} 
                onChange={e => setInput(e.target.value)}
                placeholder="E.g., Add a Postgres node that selects users..."
                disabled={isLoading || !threadId}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim() || !threadId}>
                {isLoading ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              </Button>
            </form>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">
                {navigator.platform?.includes("Mac") ? "⌘⇧A" : "Ctrl+Shift+A"} to toggle
              </span>
              {isLoading && (
                <span className="text-[10px] text-primary animate-pulse">Agent is working...</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
