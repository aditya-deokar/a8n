"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SparklesIcon,
  PlusIcon,
  MinusIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────

export interface DraftPreviewData {
  nodes?: Array<{
    id: string;
    type?: string;
    data?: { label?: string; type?: string };
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  /** Nodes added in this draft. */
  addedNodes?: string[];
  /** Nodes removed in this draft. */
  removedNodes?: string[];
  /** Nodes modified in this draft. */
  changedNodes?: string[];
  /** Validation issues, if any. */
  validationErrors?: string[];
}

export interface AgentDraftPreviewProps {
  preview: DraftPreviewData;
  /** Workflow ID for the "Open in Editor" link. */
  workflowId?: string | null;
  /** Callback when user clicks "Open in Editor" (overrides default link behavior). */
  onOpenInEditor?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function countChanges(preview: DraftPreviewData) {
  const added = preview.addedNodes?.length ?? 0;
  const removed = preview.removedNodes?.length ?? 0;
  const changed = preview.changedNodes?.length ?? 0;
  const totalNodes = preview.nodes?.length ?? 0;
  const totalEdges = preview.edges?.length ?? 0;
  return { added, removed, changed, totalNodes, totalEdges };
}

// ─── Component ───────────────────────────────────────────────

export function AgentDraftPreview({
  preview,
  workflowId,
  onOpenInEditor,
}: AgentDraftPreviewProps) {
  const counts = countChanges(preview);
  const hasValidationErrors =
    preview.validationErrors && preview.validationErrors.length > 0;

  return (
    <div className="mt-3 max-w-md">
      <Card className="shadow-sm border-border/60 bg-card/80 overflow-hidden">
        {/* Gradient accent strip */}
        <div className="h-1 bg-gradient-to-r from-[#5c54a4] to-[#9187ce]" />

        <CardHeader className="p-3 pb-1.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <SparklesIcon className="size-3 text-[#5c54a4]" />
              Draft Preview
            </CardTitle>
            {hasValidationErrors ? (
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[9px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-800/40"
              >
                <AlertCircleIcon className="size-2.5 mr-0.5" />
                {preview.validationErrors!.length} issue
                {preview.validationErrors!.length !== 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[9px] bg-green-50 dark:bg-green-950/30 text-green-600 border-green-200 dark:border-green-800/40"
              >
                <CheckCircle2Icon className="size-2.5 mr-0.5" />
                Valid
              </Badge>
            )}
          </div>
          <CardDescription className="text-[10px] mt-0.5">
            {counts.totalNodes} node{counts.totalNodes !== 1 ? "s" : ""},{" "}
            {counts.totalEdges} connection{counts.totalEdges !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3 pt-0 space-y-2">
          {/* Change summary */}
          {(counts.added > 0 || counts.removed > 0 || counts.changed > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {counts.added > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded-md">
                  <PlusIcon className="size-2.5" />
                  {counts.added} added
                </div>
              )}
              {counts.removed > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-md">
                  <MinusIcon className="size-2.5" />
                  {counts.removed} removed
                </div>
              )}
              {counts.changed > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-md">
                  <RefreshCwIcon className="size-2.5" />
                  {counts.changed} modified
                </div>
              )}
            </div>
          )}

          {/* Validation errors */}
          {hasValidationErrors && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 space-y-0.5 p-2 rounded-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              {preview.validationErrors!.slice(0, 3).map((err, i) => (
                <div key={i} className="flex items-start gap-1">
                  <AlertCircleIcon className="size-2.5 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
              {preview.validationErrors!.length > 3 && (
                <span className="text-[9px] opacity-70">
                  +{preview.validationErrors!.length - 3} more...
                </span>
              )}
            </div>
          )}

          {/* Node list preview */}
          {preview.nodes && preview.nodes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preview.nodes.slice(0, 6).map((node) => (
                <Badge
                  key={node.id}
                  variant="secondary"
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-5 font-mono",
                    preview.addedNodes?.includes(node.id) &&
                      "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30",
                    preview.removedNodes?.includes(node.id) &&
                      "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 line-through opacity-60",
                    preview.changedNodes?.includes(node.id) &&
                      "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30",
                  )}
                >
                  {node.data?.label || node.data?.type || node.type || node.id}
                </Badge>
              ))}
              {preview.nodes.length > 6 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-5">
                  +{preview.nodes.length - 6} more
                </Badge>
              )}
            </div>
          )}

          {/* Open in Editor */}
          {workflowId ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 mt-1"
              asChild
              onClick={onOpenInEditor}
            >
              <Link href={`/workflows/${workflowId}`}>
                <ExternalLinkIcon className="size-3 mr-1.5" />
                Open in Editor
              </Link>
            </Button>
          ) : onOpenInEditor ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 mt-1"
              onClick={onOpenInEditor}
            >
              <ExternalLinkIcon className="size-3 mr-1.5" />
              Open in Editor
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
