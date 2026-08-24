"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";

export interface QuotaModalDetails {
  feature: string;
  used: number;
  limit: number;
  windowResetAt: string | null;
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quota?: QuotaModalDetails | null;
}

function quotaTitle(feature: string): string {
  switch (feature) {
    case "workflow":
      return "Workflow limit reached";
    case "credential":
      return "Credential limit reached";
    case "agent_chat":
      return "Monthly chat limit reached";
    default:
      return "Upgrade to Pro";
  }
}

function quotaMessage(details: QuotaModalDetails): string {
  switch (details.feature) {
    case "workflow":
      return `You've used ${details.used} of ${details.limit} free workflows. Your existing workflows keep working — upgrade to Pro for unlimited new ones.`;
    case "credential":
      return `You've used ${details.used} of ${details.limit} free credentials. Upgrade to Pro for unlimited credentials.`;
    case "agent_chat": {
      const reset = details.windowResetAt
        ? new Date(details.windowResetAt).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
          })
        : null;
      const resetNote = reset ? ` Your chats reset on ${reset}.` : "";
      return `You've used all ${details.limit} free agent chats this month.${resetNote} Upgrade to Pro for 500 chats per month.`;
    }
    default:
      return "You need more capacity to perform this action. Upgrade to Pro to unlock it.";
  }
}

export const UpgradeModal = ({
  open,
  onOpenChange,
  quota,
}: UpgradeModalProps) => {
  const title = quota ? quotaTitle(quota.feature) : "Upgrade to Pro";
  const description = quota
    ? quotaMessage(quota)
    : "You need an active subscription to perform this action. Upgrade to Pro to unlock all features.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe later</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => authClient.checkout({ slug: "pro" })}
          >
            Upgrade Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
