"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2Icon, SendIcon, XIcon, CheckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentEvent } from "@/agent/api/events";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  isStreaming?: boolean;
  approvalId?: string;
  preview?: any;
}

export function AgentSidebar({ workflowId }: { workflowId: string }) {
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useAtom(isAgentSidebarOpenAtom);
  const setGraphMode = useSetAtom(graphModeAtom);
  const setDraftPreview = useSetAtom(draftPreviewAtom);
  const isCanvasDirty = useAtomValue(isCanvasDirtyAtom);
  const queryClient = useQueryClient();
  
  const [threadId, setThreadId] = useState<string | null>(null);
  
  const ensureThread = useMutation(trpc.agent.ensureThread.mutationOptions({
    onSuccess: (data: any) => setThreadId(data.id),
  }));
  const approveMutation = useMutation(trpc.agent.approveApproval.mutationOptions());
  const rejectMutation = useMutation(trpc.agent.rejectApproval.mutationOptions());

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load thread on mount
  useEffect(() => {
    ensureThread.mutate({ workflowId }, {
      onSuccess: (data) => setThreadId(data.id),
    });
  }, [workflowId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    const userMessage = input;
    setInput("");
    setIsLoading(true);
    const msgId = Date.now().toString();

    setMessages(prev => [...prev, { id: `user-${msgId}`, role: "user", text: userMessage }]);
    setMessages(prev => [...prev, { id: `agent-${msgId}`, role: "agent", text: "", isStreaming: true }]);

    try {
      const response = await fetch(`/api/agent/threads/${threadId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, clientMessageId: msgId }),
      });

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
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6)) as AgentEvent;
                if (data.type === "message.delta") {
                  agentText += data.payload.text || "";
                  setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, text: agentText } : m));
                } else if (data.type === "approval.requested") {
                  setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, approvalId: data.payload.approvalId as string } : m));
                } else if (data.type === "draft.updated") {
                  if (data.payload.status === "previewed" && data.payload.preview) {
                    setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, preview: data.payload.preview } : m));
                    setDraftPreview(data.payload.preview as { nodes?: any[], edges?: any[] });
                    setGraphMode("draft");
                  }
                } else if (data.type === "workflow.applied") {
                  setGraphMode("applied");
                  queryClient.invalidateQueries(trpc.workflows.getOne.queryOptions({ id: workflowId }));
                  toast.success("Agent changes applied successfully!");
                  
                  // Give it a moment to show "applied", then back to live
                  setTimeout(() => setGraphMode("live"), 2000);
                }
              } catch (err) {
                // Ignore parse errors on incomplete chunks
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, text: m.text + "\n*(Error communicating with agent)*" } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === `agent-${msgId}` ? { ...m, isStreaming: false } : m));
      setIsLoading(false);
    }
  };

  const handleApprove = async (approvalId: string, messageId: string) => {
    if (isCanvasDirty) {
      toast.error("You have unsaved changes on the canvas. Please save them before applying a draft.");
      return;
    }
    await approveMutation.mutateAsync({ approvalId });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, approvalId: undefined } : m));
    // The approval endpoint resumes the stream, which is complex to hook into here,
    // so we just optimistically clear the approval card.
  };

  const handleReject = async (approvalId: string, messageId: string) => {
    await rejectMutation.mutateAsync({ approvalId, reason: "User rejected from UI" });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, approvalId: undefined } : m));
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-transparent">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
        <h3 className="font-semibold text-sm">Agent Assistant</h3>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <MessageScrollerProvider>
          <MessageScroller className="flex-1 w-full">
            <MessageScrollerViewport>
              <MessageScrollerContent className="p-4 flex flex-col gap-4">
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center mt-10">
                    How can I help you build your workflow?
                  </div>
                )}
                {messages.map(msg => (
            <Message key={msg.id} role={msg.role} className="w-full">
              <Bubble className="text-sm w-fit max-w-[90%]">
                <div className="whitespace-pre-wrap">{msg.text}</div>
                {msg.isStreaming && <span className="animate-pulse inline-block ml-1">...</span>}
              </Bubble>
              
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
                  </Message>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input 
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
      </div>
    </div>
  );
}
