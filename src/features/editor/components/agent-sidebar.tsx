"use client";

import { useEffect, useState, useRef, useCallback, FormEvent } from "react";
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
import { AgentEvent } from "@/agent/api/events";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AgentMemoryPanel } from "./agent-memory-panel";


// ─── Types ───────────────────────────────────────────────────

interface ToolActivity {
  name: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  isStreaming?: boolean;
  approvalId?: string;
  preview?: any;
  toolActivity?: ToolActivity[];
  error?: { code: string; message: string };
  runStatus?: "started" | "completed" | "failed" | "cancelled";
}

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

  const ensureThread = useMutation(trpc.agent.ensureThread.mutationOptions({
    onSuccess: (data: any) => setThreadId(data.id),
  }));
  const approveMutation = useMutation(trpc.agent.approveApproval.mutationOptions());
  const rejectMutation = useMutation(trpc.agent.rejectApproval.mutationOptions());

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // ─── SSE Stream Handler ───

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    const userMessage = input;
    setInput("");
    setIsLoading(true);
    const msgId = Date.now().toString();

    setMessages(prev => [...prev, { id: `user-${msgId}`, role: "user", text: userMessage }]);
    setMessages(prev => [...prev, { 
      id: `agent-${msgId}`, role: "agent", text: "", 
      isStreaming: true, toolActivity: [], runStatus: "started" 
    }]);

    try {
      const response = await fetch(`/api/agent/threads/${threadId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, clientMessageId: msgId }),
      });

      // Handle non-SSE error responses (safety blocks, validation errors)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ code: "UNKNOWN", message: "Agent request failed." }));
        
        if (errorData.code === "AGENT_SAFETY_BLOCKED") {
          toast.error("Message blocked by safety policy", {
            description: errorData.message,
            icon: <ShieldAlertIcon className="size-4" />,
          });
        }

        setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { 
          ...m, text: "", isStreaming: false, 
          error: { code: errorData.code, message: errorData.message },
          runStatus: "failed",
        } : m));
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
          const lines = chunk.split('\n');
          for (const line of lines) {
            // Handle SSE error events
            if (line.startsWith('event: error')) {
              continue; // The data line follows
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6)) as AgentEvent;

                switch (data.type) {
                  case "message.delta":
                    agentText += data.payload.text || "";
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, text: agentText } : m));
                    break;

                  case "tool.call.started":
                    setMessages(prev => prev.map(m => {
                      if (m.id !== `agent-${msgId}`) return m;
                      const activity: ToolActivity = {
                        name: data.payload.toolName as string,
                        status: "running",
                        startedAt: Date.now(),
                      };
                      return { ...m, toolActivity: [...(m.toolActivity || []), activity] };
                    }));
                    break;

                  case "tool.call.completed":
                    setMessages(prev => prev.map(m => {
                      if (m.id !== `agent-${msgId}`) return m;
                      const updated = (m.toolActivity || []).map(ta =>
                        ta.name === data.payload.toolName && ta.status === "running"
                          ? { ...ta, status: "completed" as const }
                          : ta
                      );
                      return { ...m, toolActivity: updated };
                    }));
                    break;

                  case "approval.requested":
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, approvalId: data.payload.approvalId as string } : m));
                    break;

                  case "draft.updated":
                    if (data.payload.status === "previewed" && data.payload.preview) {
                      setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, preview: data.payload.preview } : m));
                      setDraftPreview(data.payload.preview as { nodes?: any[], edges?: any[] });
                      setGraphMode("draft");
                    }
                    break;

                  case "workflow.applied":
                    setGraphMode("applied");
                    queryClient.invalidateQueries(trpc.workflows.getOne.queryOptions({ id: workflowId }));
                    toast.success("Agent changes applied successfully!");
                    setTimeout(() => setGraphMode("live"), 2000);
                    break;

                  case "run.completed":
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, runStatus: "completed" } : m));
                    break;

                  case "run.failed":
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? {
                      ...m,
                      runStatus: "failed",
                      error: {
                        code: (data.payload.code as string) || "AGENT_RUN_FAILED",
                        message: (data.payload.message as string) || "The agent run failed.",
                      },
                    } : m));
                    break;

                  case "run.cancelled":
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, runStatus: "cancelled" } : m));
                    break;
                }
              } catch (err) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { 
        ...m, text: m.text + "\n*(Error communicating with agent)*",
        runStatus: "failed",
      } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, isStreaming: false } : m));
      setIsLoading(false);
    }
  };

  // ─── Approval Handlers ───

  const handleApprove = async (approvalId: string, messageId: string) => {
    if (isCanvasDirty) {
      toast.error("You have unsaved changes on the canvas. Please save them before applying a draft.");
      return;
    }
    await approveMutation.mutateAsync({ approvalId });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, approvalId: undefined } : m));
  };

  const handleReject = async (approvalId: string, messageId: string) => {
    await rejectMutation.mutateAsync({ approvalId, reason: "User rejected from UI" });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, approvalId: undefined } : m));
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
