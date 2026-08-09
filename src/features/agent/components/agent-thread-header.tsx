"use client";

import { Button } from "@/components/ui/button";
import {
  BrainIcon,
  WorkflowIcon,
  ChevronDownIcon,
  PanelLeftIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

export interface AgentThreadHeaderProps {
  /** Thread title (or null for untitled). */
  title: string | null;
  /** Name of the attached workflow, if any. */
  workflowName?: string | null;
  /** Agent run status indicator. */
  isLoading: boolean;
  /** Called when the memory panel toggle is clicked. */
  onToggleMemory: () => void;
  /** Whether the memory panel is currently open. */
  isMemoryOpen: boolean;
  /** Called when the workflow picker should open. */
  onOpenWorkflowPicker?: () => void;
  /** Called to toggle the thread list on mobile. */
  onToggleThreadList?: () => void;
}

// ─── Component ───────────────────────────────────────────────

export function AgentThreadHeader({
  title,
  workflowName,
  isLoading,
  onToggleMemory,
  isMemoryOpen,
  onOpenWorkflowPicker,
  onToggleThreadList,
}: AgentThreadHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 border-b border-border/40 bg-background/60 backdrop-blur-sm shrink-0">
      {/* Left side */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile thread list toggle */}
        {onToggleThreadList && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 md:hidden shrink-0"
            onClick={onToggleThreadList}
          >
            <PanelLeftIcon className="size-4" />
          </Button>
        )}

        {/* Thread title */}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground truncate">
            {title || "New conversation"}
          </h2>
          {/* Workflow badge */}
          {workflowName ? (
            <button
              onClick={onOpenWorkflowPicker}
              className="flex items-center gap-1 mt-0.5 group"
            >
              <WorkflowIcon className="size-2.5 text-[#5c54a4]" />
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[200px]">
                {workflowName}
              </span>
              <ChevronDownIcon className="size-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ) : onOpenWorkflowPicker ? (
            <button
              onClick={onOpenWorkflowPicker}
              className="flex items-center gap-1 mt-0.5 group"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                Attach a workflow...
              </span>
              <ChevronDownIcon className="size-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Status indicator */}
        {isLoading && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#5c54a4]/10 mr-1">
            <Loader2Icon className="size-3 animate-spin text-[#5c54a4]" />
            <span className="text-[10px] font-medium text-[#5c54a4] hidden sm:inline">
              Working...
            </span>
          </div>
        )}

        {/* Memory toggle */}
        <Button
          variant={isMemoryOpen ? "secondary" : "ghost"}
          size="icon"
          className={cn(
            "size-8 transition-colors",
            isMemoryOpen && "bg-[#5c54a4]/10 text-[#5c54a4]",
          )}
          onClick={onToggleMemory}
          title="Agent Memory"
        >
          <BrainIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
