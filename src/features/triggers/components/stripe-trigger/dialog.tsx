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
import { useSetWebhookSecret } from "@/features/workflows/hooks/use-workflows";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId?: string;
  defaultValues?: {
    webhookSecret?: string;
  };
};

export const StripeTriggerDialog = ({
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
    `${baseUrl}/api/webhooks/stripe?workflowId=${workflowId}`;

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
            "Signing secret saved — incoming events are verified against it",
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
          <DialogTitle>Stripe Trigger Configuration</DialogTitle>
          <DialogDescription>
            Configure this webhook URL in your Stripe Dashboard to trigger this workflow on payment events.
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

          <div className="rounded-lg border border-gray-200 dark:border-zinc-800 p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <KeyRoundIcon className="size-4" />
              Signing secret
            </h4>
            <p className="text-xs text-muted-foreground">
              Paste the signing secret from your Stripe webhook endpoint. It is
              stored encrypted and used to verify every event signature.
            </p>
            {defaultValues?.webhookSecret && (
              <p className="text-xs text-green-700 dark:text-green-400">
                A signing secret is configured for this trigger.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={
                  defaultValues?.webhookSecret ? "Replace secret…" : "whsec_…"
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

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Setup instructions:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open your Stripe Dashboard</li>
              <li>Go to Developers → Webhooks</li>
              <li>Click "Add endpoint"</li>
              <li>Paste the webhook URL above</li>
              <li>Select events to listen for (e.g., payment_intent.succeeded)</li>
              <li>Copy the signing secret and save it above</li>
              <li>Activate this workflow from the workflows dashboard</li>
            </ol>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium text-sm">Available Variables</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{stripe.eventType}}"}</code> - Event type (e.g., payment_intent.succeeded)</li>
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{stripe.eventId}}"}</code> - Event ID</li>
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{stripe.raw.amount}}"}</code> - Payment amount (in cents)</li>
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{stripe.raw.currency}}"}</code> - Currency code</li>
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{stripe.raw.customer}}"}</code> - Customer ID</li>
              <li><code className="bg-background px-1 py-0.5 rounded">{"{{json stripe.raw}}"}</code> - Full event object as JSON</li>
            </ul>
          </div>
        </div>
      </NodeDialogContent>
    </Dialog>
  );
};
