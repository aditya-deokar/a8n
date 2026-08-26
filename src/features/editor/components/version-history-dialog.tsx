"use client";

import { formatDistanceToNow } from "date-fns";
import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useRestoreWorkflowVersion,
  useWorkflowVersions,
} from "@/features/workflows/hooks/use-workflows";
import { useAtomValue } from "jotai";
import { isCanvasDirtyAtom } from "../store/atoms";
import { toast } from "sonner";

interface Props {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VersionHistoryDialog = ({ workflowId, open, onOpenChange }: Props) => {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <VersionHistoryContent workflowId={workflowId} onOpenChange={onOpenChange} />
    </Dialog>
  );
};

const VersionHistoryContent = ({
  workflowId,
  onOpenChange,
}: Omit<Props, "open">) => {
  const { data } = useWorkflowVersions(workflowId);
  const restore = useRestoreWorkflowVersion();
  const isCanvasDirty = useAtomValue(isCanvasDirtyAtom);

  const handleRestore = (versionId: string) => {
    if (isCanvasDirty) {
      toast.error("Save or discard your current changes before restoring");
      return;
    }
    restore.mutate({ workflowId, versionId });
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <HistoryIcon className="size-5" />
          Version history
        </DialogTitle>
        <DialogDescription>
          Every save is snapshotted. Restore a previous version — the current
          state is auto-saved first, so restores are reversible.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No saved versions yet.
          </p>
        ) : (
          data.items.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {version.summary || "Saved version"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>
                    {formatDistanceToNow(version.createdAt, { addSuffix: true })}
                  </span>
                  <span>·</span>
                  <span>
                    {version.nodeCount} nodes · {version.edgeCount} connections
                  </span>
                  {version.createdByTool === "agent" && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      agent
                    </Badge>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={restore.isPending}
                onClick={() => handleRestore(version.id)}
              >
                <RotateCcwIcon className="size-3.5 mr-1.5" />
                Restore
              </Button>
            </div>
          ))
        )}
      </div>
    </DialogContent>
  );
};
