"use client";

import { useState, useMemo } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Loader2Icon,
  CheckIcon,
  AlertTriangleIcon,
  WrenchIcon,
  ChevronDownIcon,
  ClockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolActivity } from "@/features/agent/types";

// ─── Types ───────────────────────────────────────────────────

export interface AgentToolActivityProps {
  activities: ToolActivity[];
  /** Whether the parent message is still streaming (affects "running" display). */
  isStreaming?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDuration(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 1000) return `${elapsed}ms`;
  return `${(elapsed / 1000).toFixed(1)}s`;
}

function getStatusColor(status: ToolActivity["status"]) {
  switch (status) {
    case "running":
      return "text-[#5c54a4] dark:text-[#9187ce]";
    case "completed":
      return "text-green-500";
    case "failed":
      return "text-red-500";
  }
}

function getStatusIcon(status: ToolActivity["status"]) {
  switch (status) {
    case "running":
      return <Loader2Icon className="size-3 animate-spin" />;
    case "completed":
      return <CheckIcon className="size-3" />;
    case "failed":
      return <AlertTriangleIcon className="size-3" />;
  }
}

// ─── Single Tool Item ────────────────────────────────────────

function ToolItem({ activity }: { activity: ToolActivity }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
      <div className={cn("shrink-0", getStatusColor(activity.status))}>
        {getStatusIcon(activity.status)}
      </div>
      <WrenchIcon className="size-3 text-muted-foreground/50 shrink-0" />
      <span className="text-xs font-mono text-foreground/80 truncate flex-1">
        {activity.name}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {activity.status === "running" && (
          <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#5c54a4] dark:bg-[#9187ce] rounded-full animate-pulse w-2/3" />
          </div>
        )}
        <span className="text-[10px] tabular-nums text-muted-foreground flex items-center gap-0.5">
          <ClockIcon className="size-2.5" />
          {formatDuration(activity.startedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function AgentToolActivity({ activities, isStreaming }: AgentToolActivityProps) {
  const [isOpen, setIsOpen] = useState(true);

  const summary = useMemo(() => {
    const running = activities.filter((a) => a.status === "running").length;
    const completed = activities.filter((a) => a.status === "completed").length;
    const failed = activities.filter((a) => a.status === "failed").length;
    return { running, completed, failed, total: activities.length };
  }, [activities]);

  if (activities.length === 0) return null;

  // Single tool — show inline without collapsible
  if (activities.length === 1) {
    return (
      <div className="mt-2">
        <ToolItem activity={activities[0]} />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors group">
        <WrenchIcon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground/80">
          {summary.total} tool{summary.total !== 1 ? "s" : ""} used
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {summary.running > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] font-mono bg-[#5c54a4]/10 text-[#5c54a4] border-[#5c54a4]/20"
            >
              {summary.running} running
            </Badge>
          )}
          {summary.completed > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] font-mono bg-green-50 dark:bg-green-950/30 text-green-600 border-green-200 dark:border-green-800/40"
            >
              {summary.completed} done
            </Badge>
          )}
          {summary.failed > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] font-mono bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-800/40"
            >
              {summary.failed} failed
            </Badge>
          )}
          <ChevronDownIcon
            className={cn(
              "size-3 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-0.5 flex flex-col gap-0.5 pl-2 border-l-2 border-muted ml-[9px]">
        {activities.map((activity, i) => (
          <ToolItem key={`${activity.name}-${i}`} activity={activity} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
