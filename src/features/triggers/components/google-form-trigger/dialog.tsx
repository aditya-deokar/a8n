"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NodeDialogContent } from "@/components/node-dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyIcon, KeyRoundIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { generateGoogleFormScript } from "./utils";
import { useSetWebhookSecret } from "@/features/workflows/hooks/use-workflows";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId?: string;
  defaultValues?: {
    webhookSecret?: string;
  };
};

export const GoogleFormTriggerDialog = ({
  open,
  onOpenChange,
  nodeId,
  defaultValues,
}: Props) => {
  const params = useParams();
  const workflowId = params.workflowId as string;
  const setWebhookSecret = useSetWebhookSecret();
  const [secret, setSecret] = useState("");

  useEffect(() => {
    if (open) setSecret("");
  }, [open]);

  // Construct the webhook URL
  const baseUrl =
    process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  const webhookUrl = 
    `${baseUrl}/api/webhooks/google-form?workflowId=${workflowId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleSaveSecret = () => {
    if (!nodeId || !secret.trim()) return;
    setWebhookSecret.mutate(
      { workflowId, nodeId, secret: secret.trim() },
      {
        onSuccess: () => {
          toast.success(
            "Webhook secret saved — paste the same value into WEBHOOK_SECRET in your Apps Script",
          );
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <NodeDialogContent>
        <DialogHeader>
          <DialogTitle>Google Form Trigger Configuration</DialogTitle>
          <DialogDescription>
            Use this webhook URL in your Google Form's Apps Script to trigger
            this workflow when a form is submitted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={copyToClipboard}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Setup instructions:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open your Google Form</li>
              <li>Click the three dots menu → Script editor</li>
              <li>Copy and paste the script below</li>
              <li>Replace WEBHOOK_URL with your webhook URL above</li>
              <li>Replace WEBHOOK_SECRET with your webhook secret</li>
              <li>Save and click "Triggers" → Add Trigger</li>
              <li>Choose: From form → On form submit → Save</li>
            </ol>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <KeyRoundIcon className="size-4" />
              Webhook secret
            </h4>
            <p className="text-xs text-muted-foreground">
              Set this to the same value as GOOGLE_FORM_WEBHOOK_SECRET (or
              A8N_WEBHOOK_SHARED_SECRET) in the deployment environment. The
              generated script sends it in the{" "}
              <code className="bg-background px-1 py-0.5 rounded">x-a8n-webhook-secret</code>{" "}
              header — requests without a valid secret are rejected.
            </p>
            {defaultValues?.webhookSecret && (
              <p className="text-xs text-green-700 dark:text-green-400">
                A secret is configured for this trigger.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={
                  defaultValues?.webhookSecret ? "Replace secret…" : "Paste webhook secret…"
                }
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!secret.trim() || !nodeId || setWebhookSecret.isPending}
                onClick={handleSaveSecret}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-3">
            <h4 className="font-medium text-sm">Google Apps Script:</h4>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const script = generateGoogleFormScript(webhookUrl);
                try {
                  await navigator.clipboard.writeText(script);
                  toast.success("Script copied to clipboard");
                } catch {
                  toast.error("Failed to copy Script to clipboard");
                }
              }}
            >
              <CopyIcon className="size-4 mr-2" />
              Copy Google Apps Script
            </Button>
            <p className="text-xs text-muted-foreground">
              This script includes your webhook URL and handles form submissions
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available Variables</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{googleForm.respondentEmail}}"}
                </code>
                - Respondent's email
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{googleForm.responses['Question Name']}}"}
                </code>
                - Specific answer
              </li>
              <li>
                <code className="bg-background px-1 py-0.5 rounded">
                  {"{{json googleForm.responses}}"}
                </code>{" "}
                - All responses as JSON
              </li>
            </ul>
          </div>
        </div>
      </NodeDialogContent>
    </Dialog>
  );
};
