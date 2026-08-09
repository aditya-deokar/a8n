"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────

export interface AgentWorkflowAppliedProps {
  /** The workflow ID where changes were applied. */
  workflowId: string;
  /** The workflow name, if available. */
  workflowName?: string | null;
  /** Summary of the applied changes, if available. */
  changeSummary?: string | null;
}

// ─── Component ───────────────────────────────────────────────

export function AgentWorkflowApplied({
  workflowId,
  workflowName,
  changeSummary,
}: AgentWorkflowAppliedProps) {
  return (
    <div className="mt-3 max-w-md">
      <Card className="shadow-sm border-green-200/60 dark:border-green-800/40 bg-gradient-to-br from-green-50/80 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20 overflow-hidden">
        {/* Success gradient strip */}
        <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />

        <CardHeader className="p-3 pb-1.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <CheckCircle2Icon className="size-3.5 text-green-500" />
              <span className="text-green-700 dark:text-green-400">
                Changes Applied
              </span>
            </CardTitle>
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] bg-green-100/50 dark:bg-green-900/30 text-green-600 border-green-200/80 dark:border-green-700/40"
            >
              <SparklesIcon className="size-2.5 mr-0.5" />
              Live
            </Badge>
          </div>
          {changeSummary && (
            <CardDescription className="text-[10px] mt-1">
              {changeSummary}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="p-3 pt-0 flex items-center gap-2">
          {/* Workflow info */}
          {workflowName && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-1 min-w-0 truncate">
              <WorkflowIcon className="size-2.5 shrink-0" />
              <span className="truncate">{workflowName}</span>
            </div>
          )}

          {/* Open in Editor */}
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2 shrink-0 bg-white/60 dark:bg-background/60"
            asChild
          >
            <Link href={`/workflows/${workflowId}`}>
              <ExternalLinkIcon className="size-2.5 mr-1" />
              Open in Editor
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
