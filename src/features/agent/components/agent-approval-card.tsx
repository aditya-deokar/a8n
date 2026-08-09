"use client";

import { useState, useCallback } from "react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldAlertIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

export interface AgentApprovalCardProps {
  approvalId: string;
  messageId: string;
  /** Called when the user approves. */
  onApprove: (approvalId: string, messageId: string) => void;
  /** Called when the user rejects (with optional reason). */
  onReject: (approvalId: string, messageId: string, reason?: string) => void;
  /** Whether an approval/reject mutation is in-flight. */
  isPending?: boolean;
  /** Whether this approval has already been resolved (show disabled state). */
  isResolved?: boolean;
  /** The resolution result, if resolved. */
  resolution?: "approved" | "rejected" | null;
}

// ─── Component ───────────────────────────────────────────────

export function AgentApprovalCard({
  approvalId,
  messageId,
  onApprove,
  onReject,
  isPending = false,
  isResolved = false,
  resolution = null,
}: AgentApprovalCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [animateApprove, setAnimateApprove] = useState(false);

  const handleApprove = useCallback(() => {
    setAnimateApprove(true);
    onApprove(approvalId, messageId);
    setTimeout(() => setAnimateApprove(false), 1500);
  }, [approvalId, messageId, onApprove]);

  const handleReject = useCallback(() => {
    onReject(approvalId, messageId, rejectReason || undefined);
    setShowRejectDialog(false);
    setRejectReason("");
  }, [approvalId, messageId, rejectReason, onReject]);

  // Resolved state — show outcome
  if (isResolved && resolution) {
    return (
      <div className="mt-3 max-w-sm">
        <Card
          className={cn(
            "shadow-sm border-border/60 opacity-75",
            resolution === "approved"
              ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/30"
              : "bg-muted/50 border-border/40",
          )}
        >
          <CardHeader className="p-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              {resolution === "approved" ? (
                <>
                  <CheckCircle2Icon className="size-3 text-green-500" />
                  <span className="text-green-700 dark:text-green-400">Changes Approved</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Changes Rejected</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 max-w-sm">
        <Card
          className={cn(
            "shadow-sm overflow-hidden transition-all duration-300",
            animateApprove
              ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
              : "border-[#5c54a4]/20 bg-[#5c54a4]/5",
          )}
        >
          {/* Pulse glow effect */}
          {!isPending && !animateApprove && (
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[#5c54a4]/40 to-transparent animate-pulse" />
          )}

          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <ShieldAlertIcon className="size-3 text-[#5c54a4]" />
              Approval Required
            </CardTitle>
            <CardDescription className="text-[10px]">
              Apply these changes to your live workflow?
            </CardDescription>
          </CardHeader>

          <CardFooter className="p-3 pt-1 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setShowRejectDialog(true)}
              disabled={isPending}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className={cn(
                "flex-1 h-7 text-xs border-0 text-white transition-all duration-300",
                animateApprove
                  ? "bg-green-500 hover:bg-green-500"
                  : "bg-gradient-to-b from-[#5c54a4] to-[#9187ce]",
              )}
              onClick={handleApprove}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : animateApprove ? (
                <CheckCircle2Icon className="size-3" />
              ) : (
                "Approve"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ─── Reject with Reason Dialog ─── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Reject Changes</DialogTitle>
            <DialogDescription className="text-xs">
              Optionally provide a reason so the agent can adjust its approach.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Don't modify the webhook node, only add new nodes..."
            className="min-h-[80px] text-sm"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2Icon className="size-3 animate-spin mr-1" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
