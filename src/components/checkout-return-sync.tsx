"use client";

import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

const SYNC_MAX_ATTEMPTS = 5;
const SYNC_RETRY_DELAY_MS = 2_000;

/**
 * Fires `subscriptions.syncNow` when the user returns from Polar checkout,
 * closing the gap between the redirect and the webhook delivery. Retries a
 * few times; the webhook remains the authoritative fast path.
 */
export function CheckoutReturnSync() {
  const trpc = useTRPC();
  const attempts = useRef(0);
  const [status, setStatus] = useState<"syncing" | "ready" | "pending">(
    "syncing",
  );

  const syncNow = useMutation(
    trpc.subscriptions.syncNow.mutationOptions({
      retry: false,
      onSuccess: (result) => {
        if (result.snapshot.plan === "pro") {
          setStatus("ready");
          return;
        }
        scheduleRetry();
      },
      onError: scheduleRetry,
    }),
  );

  function scheduleRetry() {
    attempts.current += 1;
    if (attempts.current >= SYNC_MAX_ATTEMPTS) {
      setStatus("pending");
      return;
    }
    setTimeout(() => syncNow.mutate(), SYNC_RETRY_DELAY_MS);
  }

  useEffect(() => {
    syncNow.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "syncing") {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Activating your Pro features…
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="text-xs text-muted-foreground text-center">
        Your upgrade is being processed — features unlock within moments.
        Refresh if they don&apos;t appear.
      </p>
    );
  }

  return null;
}
