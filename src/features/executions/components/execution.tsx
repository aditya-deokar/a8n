"use client";

import { ExecutionStatus, NodeType } from "@/generated/prisma";
import { CheckCircle2Icon, ClockIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSuspenseExecution } from "@/features/executions/hooks/use-executions";

const getStatusIcon = (status: ExecutionStatus) => {
  switch (status) {
    case ExecutionStatus.SUCCESS:
      return <CheckCircle2Icon className="size-5 text-green-600" />;
    case ExecutionStatus.FAILED:
      return <XCircleIcon className="size-5 text-red-600" />;
    case ExecutionStatus.RUNNING:
      return <Loader2Icon className="size-5 text-blue-600 animate-spin" />;
    default:
      return <ClockIcon className="size-5 text-muted-foreground" />;
  }
}

const formatStatus = (status: ExecutionStatus) => {
  return status.charAt(0) + status.slice(1).toLowerCase();
};

/** Human-friendly label per node type. */
const nodeTypeLabel = (type: NodeType): string => {
  const labels: Partial<Record<NodeType, string>> = {
    [NodeType.INITIAL]: "Start",
    [NodeType.MANUAL_TRIGGER]: "Manual Trigger",
    [NodeType.GOOGLE_FORM_TRIGGER]: "Google Form Trigger",
    [NodeType.STRIPE_TRIGGER]: "Stripe Trigger",
    [NodeType.HTTP_REQUEST]: "HTTP Request",
    [NodeType.OPENAI]: "OpenAI",
    [NodeType.ANTHROPIC]: "Anthropic",
    [NodeType.GEMINI]: "Gemini",
    [NodeType.DISCORD]: "Discord",
    [NodeType.SLACK]: "Slack",
    [NodeType.EMAIL]: "Email",
    [NodeType.GOOGLE_SHEETS]: "Google Sheets",
  };
  return labels[type] ?? type;
};

const formatDuration = (durationMs?: number | null) => {
  if (durationMs == null) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
};

export const ExecutionView = ({
  executionId
}: { 
  executionId: string
}) => {
  const { data: execution } = useSuspenseExecution(executionId);
  const [showStackTrace, setShowStackTrace] = useState(false);

  const duration = execution.completedAt
    ? Math.round(
      (new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000,
    )
    : null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center gap-3">
          {getStatusIcon(execution.status)}
          <div>
            <CardTitle>
              {formatStatus(execution.status)}
            </CardTitle>
            <CardDescription>
              Execution for {execution.workflow.name}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Workflow
            </p>
            <Link 
              prefetch
              className="text-sm hover:underline text-primary"
              href={`/workflows/${execution.workflowId}`}
            >
              {execution.workflow.name}
            </Link>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-sm">{formatStatus(execution.status)}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Started</p>
            <p className="text-sm">{formatDistanceToNow(execution.startedAt, { addSuffix: true })}</p>
          </div>

          {execution.completedAt ? (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-sm">{formatDistanceToNow(execution.completedAt, { addSuffix: true })}</p>
            </div>
          ) : null}

          {duration !== null ? (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration</p>
              <p className="text-sm">
                {duration === 0 ? "<1s" : `${duration}s`}
              </p>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-medium text-muted-foreground">Event ID</p>
            <p className="text-sm">{execution.inngestEventId}</p>
          </div>
          </div>
          {execution.error && (
            <div className="mt-6 p-4 bg-red-50 rounded-md space-y-3">
              <div>
                <p className="text-sm font-medium text-red-900 mb-2">
                  Error
                </p>
                <p className="text-sm text-red-800 font-mono">
                  {execution.error}
                </p>
              </div>

              {execution.errorStack && (
                <Collapsible
                  open={showStackTrace}
                  onOpenChange={setShowStackTrace}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-900 hover:bg-red-100"
                    >
                      {showStackTrace
                        ? "Hide stack trace"
                        : "Show stack trace"
                      }
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="text-xs font-mono text-red-800 overflow-auto mt-2 p-2 bg-red-100">
                      {execution.errorStack}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          <NodeRunTimeline nodeRuns={execution.nodeRuns} />

          {execution.output && (
            <div className="mt-6 p-4 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Output</p>
              <pre className="text-xs font-mono overflow-auto">
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          )}
      </CardContent>
    </Card>
  );
};

/** Vertical per-node timeline rendered under the execution summary. */
const NodeRunTimeline = ({
  nodeRuns,
}: {
  nodeRuns: Array<{
    id: string;
    nodeId: string;
    nodeType: NodeType;
    status: ExecutionStatus;
    startedAt: Date | string;
    completedAt: Date | string | null;
    durationMs?: number | null;
    error?: string | null;
  }>;
}) => {
  if (nodeRuns.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-sm font-medium mb-3">Node timeline</p>
      <ol className="relative space-y-2 border-l border-gray-200 dark:border-zinc-800 ml-3 pl-5">
        {nodeRuns.map((run) => {
          const duration = formatDuration(run.durationMs);
          return (
            <li key={run.id} className="relative">
              <span className="absolute -left-[27px] top-1.5 flex size-4 items-center justify-center rounded-full bg-background">
                {run.status === ExecutionStatus.SUCCESS ? (
                  <CheckCircle2Icon className="size-4 text-green-600" />
                ) : run.status === ExecutionStatus.FAILED ? (
                  <XCircleIcon className="size-4 text-red-600" />
                ) : (
                  <Loader2Icon className="size-4 text-blue-600 animate-spin" />
                )}
              </span>
              <div
                className={
                  run.status === ExecutionStatus.FAILED
                    ? "rounded-lg border border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30 px-3 py-2"
                    : "rounded-lg border border-gray-100 dark:border-zinc-800 px-3 py-2"
                }
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">{nodeTypeLabel(run.nodeType)}</p>
                  {duration !== null && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {duration}
                    </span>
                  )}
                </div>
                {run.error && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-400 font-mono break-words">
                    {run.error}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
