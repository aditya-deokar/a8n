import { TRPCError } from "@trpc/server";
import {
  entitlementsActiveForUser,
  type QuotaFeature,
} from "@/config/plans";
import { QuotaExceededError } from "@/lib/entitlements/errors";
import { consumeExecutionQuota } from "@/lib/entitlements/consume";

export function quotaTrpcError(error: unknown): TRPCError | null {
  if (!(error instanceof QuotaExceededError)) return null;
  return new TRPCError({
    code: "FORBIDDEN",
    message: error.message,
    cause: error.toPayload(),
  });
}

export async function enforceExecutionQuotaForUser(userId: string): Promise<void> {
  if (!entitlementsActiveForUser(userId)) return;
  try {
    await consumeExecutionQuota({ userId });
  } catch (error) {
    const mapped = quotaTrpcError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

export function quotaFeatureFromDetails(
  details: QuotaExceededError["details"],
): QuotaFeature {
  return details.feature;
}
