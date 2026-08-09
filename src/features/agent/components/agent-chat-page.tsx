"use client";

import { useState, useCallback, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAgentStream } from "@/features/agent/hooks/use-agent-stream";
import { useAgentApprovals } from "@/features/agent/hooks/use-agent-approvals";
import { useCreateAgentThread, useEnsureAgentThread } from "@/features/agent/hooks/use-agent-thread";
import { AgentThreadList } from "./agent-thread-list";
import { AgentThreadHeader } from "./agent-thread-header";
import { AgentMessageList } from "./agent-message-list";
import { AgentComposer } from "./agent-composer";
import { AgentEmptyState } from "./agent-empty-state";
import { AgentWorkflowPicker } from "./agent-workflow-picker";
import { AgentErrorBoundary } from "./agent-error-boundary";
import { AgentMemoryPanel } from "@/features/editor/components/agent-memory-panel";
import { toast } from "sonner";
import { ShieldAlertIcon } from "lucide-react";
import "@/features/agent/styles/agent-chat.css";

// ─── Component ───────────────────────────────────────────────

function AgentChatPageInner() {
  // ─── State ───
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isMobileThreadListOpen, setIsMobileThreadListOpen] = useState(false);
  const [isWorkflowPickerOpen, setIsWorkflowPickerOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState<string | null>(null);

  // ─── Thread management ───
  const ensureThread = useEnsureAgentThread();
  const createThread = useCreateAgentThread();

  // Create a default thread on mount if none selected
  useEffect(() => {
    if (!activeThreadId) {
      ensureThread.mutate(
        {},
        {
          onSuccess: (data) => setActiveThreadId(data.id),
        },
      );
    }
  }, []); // Run once on mount

  // ─── SSE Streaming ───
  const { messages, isLoading, sendMessage, cancel, updateMessage, clearMessages } =
    useAgentStream({
      threadId: activeThreadId,
      onDraftPreviewed: (_preview) => {
        // On standalone page, draft preview is rendered as a card in the message list
        // with a deep link to the workflow editor
      },
      onWorkflowApplied: (_workflowId) => {
        toast.success("Agent changes applied successfully!", {
          description: "Open the workflow editor to see the changes.",
        });
      },
      onSafetyBlocked: (error) => {
        toast.error("Message blocked by safety policy", {
          description: error.message,
          icon: <ShieldAlertIcon className="size-4" />,
        });
      },
    });

  // ─── Approvals ───
  const { approve, reject, isPending: isApprovePending } = useAgentApprovals();

  const handleApprove = useCallback(
    async (approvalId: string, messageId: string) => {
      const success = await approve(approvalId);
      if (success) {
        updateMessage(messageId, { approvalId: undefined });
      }
    },
    [approve, updateMessage],
  );

  const handleReject = useCallback(
    async (approvalId: string, messageId: string, reason?: string) => {
      const success = await reject(approvalId, reason || "User rejected from UI");
      if (success) {
        updateMessage(messageId, { approvalId: undefined });
      }
    },
    [reject, updateMessage],
  );

  // ─── Thread actions ───
  const handleSelectThread = useCallback(
    (threadId: string) => {
      if (threadId === activeThreadId) return;
      setActiveThreadId(threadId);
      clearMessages();
      setIsMobileThreadListOpen(false);
    },
    [activeThreadId, clearMessages],
  );

  const handleNewThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      clearMessages();
      setIsMobileThreadListOpen(false);
    },
    [clearMessages],
  );

  // ─── Workflow picker ───
  const handleWorkflowSelect = useCallback(
    (workflowId: string | null, workflowName: string | null) => {
      setSelectedWorkflowId(workflowId);
      setSelectedWorkflowName(workflowName);

      // Create a new thread scoped to this workflow
      if (workflowId) {
        createThread.mutate(
          { workflowId },
          {
            onSuccess: (data) => {
              setActiveThreadId(data.id);
              clearMessages();
              toast.success(`Attached workflow: ${workflowName}`);
            },
          },
        );
      }
    },
    [createThread, clearMessages],
  );

  // ─── Composer actions ───
  const handleSubmit = useCallback(
    async (text: string) => {
      setInput("");
      await sendMessage(text);
    },
    [sendMessage],
  );

  const handleSuggestionClick = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleViewDraft = useCallback(
    (_preview: any) => {
      if (selectedWorkflowId) {
        window.open(`/workflows/${selectedWorkflowId}`, "_blank");
      } else {
        toast.info("Attach a workflow to open the draft in the editor.");
      }
    },
    [selectedWorkflowId],
  );

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+N — New Chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        createThread.mutate(
          { workflowId: selectedWorkflowId ?? undefined },
          {
            onSuccess: (data) => {
              setActiveThreadId(data.id);
              clearMessages();
            },
          },
        );
      }

      // Ctrl+Shift+M — Toggle Memory
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setIsMemoryOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createThread, selectedWorkflowId, clearMessages]);

  // ─── Thread List Component ───
  const threadListContent = (
    <AgentThreadList
      activeThreadId={activeThreadId}
      onSelectThread={handleSelectThread}
      onNewThread={handleNewThread}
    />
  );

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-background">
      <div className="flex flex-1 min-h-0">
        {/* ─── Thread List Panel (Desktop) ─── */}
        <div className="hidden md:flex w-[280px] shrink-0 border-r border-border/40">
          {threadListContent}
        </div>

        {/* ─── Main Chat Panel ─── */}
        <div className="flex-1 flex min-h-0 min-w-0">
          {/* Chat area */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Thread Header */}
            <AgentThreadHeader
              title={null}
              workflowName={selectedWorkflowName}
              isLoading={isLoading}
              onToggleMemory={() => setIsMemoryOpen(!isMemoryOpen)}
              isMemoryOpen={isMemoryOpen}
              onOpenWorkflowPicker={() => setIsWorkflowPickerOpen(true)}
              onToggleThreadList={() =>
                setIsMobileThreadListOpen(!isMobileThreadListOpen)
              }
            />

            {/* Messages or Empty State */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {messages.length === 0 ? (
                <AgentEmptyState onSuggestionClick={handleSuggestionClick} />
              ) : (
                <AgentMessageList
                  messages={messages}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onViewDraft={handleViewDraft}
                  isApprovePending={isApprovePending}
                  workflowId={selectedWorkflowId}
                />
              )}
            </div>

            {/* Composer */}
            <AgentComposer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              onCancel={cancel}
              isLoading={isLoading}
              disabled={!activeThreadId}
              workflowName={selectedWorkflowName}
            />
          </div>

          {/* Memory Panel (slide-over) */}
          {isMemoryOpen && (
            <div className="hidden sm:flex w-72 border-l border-border/40 flex-col bg-background">
              <AgentMemoryPanel />
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile Thread List (Sheet) ─── */}
      <Sheet
        open={isMobileThreadListOpen}
        onOpenChange={setIsMobileThreadListOpen}
      >
        <SheetContent side="left" className="w-[300px] p-0">
          {threadListContent}
        </SheetContent>
      </Sheet>

      {/* ─── Mobile Memory Panel (Sheet) ─── */}
      {isMemoryOpen && (
        <Sheet open={isMemoryOpen} onOpenChange={setIsMemoryOpen}>
          <SheetContent side="right" className="w-[320px] p-0 sm:hidden">
            <AgentMemoryPanel />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// ─── Exported Component (wrapped with error boundary) ────────

export function AgentChatPage() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <AgentErrorBoundary
      key={resetKey}
      onNewChat={() => setResetKey((k) => k + 1)}
    >
      <AgentChatPageInner />
    </AgentErrorBoundary>
  );
}
