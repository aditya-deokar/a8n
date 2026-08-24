import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { UpgradeModal, type QuotaModalDetails } from "@/components/upgrade-modal";

interface QuotaWirePayload {
  code?: unknown;
  feature?: unknown;
  used?: unknown;
  limit?: unknown;
  windowResetAt?: unknown;
}

/**
 * Reads the structured quota payload the server attaches to FORBIDDEN
 * errors (see the tRPC errorFormatter). Falls back to null so legacy
 * "Active subscription required" denials keep opening the generic modal.
 */
export function extractQuotaDetails(
  error: unknown,
): QuotaModalDetails | null {
  if (!(error instanceof TRPCClientError)) return null;

  const data = error.data as QuotaWirePayload | undefined;
  if (!data || data.code !== "QUOTA_EXCEEDED") return null;
  if (typeof data.feature !== "string") return null;
  if (typeof data.used !== "number" || typeof data.limit !== "number") {
    return null;
  }

  return {
    feature: data.feature,
    used: data.used,
    limit: data.limit,
    windowResetAt:
      typeof data.windowResetAt === "string" ? data.windowResetAt : null,
  };
}

export const useUpgradeModal = () => {
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaModalDetails | null>(null);

  const handleError = (error: unknown) => {
    if (!(error instanceof TRPCClientError)) return false;

    const details = extractQuotaDetails(error);
    if (details) {
      setQuota(details);
      setOpen(true);
      return true;
    }

    if (error.data?.code === "FORBIDDEN") {
      setQuota(null);
      setOpen(true);
      return true;
    }

    return false;
  };

  const modal = (
    <UpgradeModal open={open} onOpenChange={setOpen} quota={quota} />
  );

  return { handleError, modal };
};
