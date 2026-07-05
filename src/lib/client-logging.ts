"use client";

type ClientErrorMetadata = {
  digest?: string;
  path?: string;
  requestId?: string;
  source?: string;
};

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "ClientError";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Client error";
}

function payloadFor(error: unknown, metadata: ClientErrorMetadata = {}) {
  return {
    errorName: errorName(error),
    message: errorMessage(error),
    digest: metadata.digest,
    path:
      metadata.path ||
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : undefined),
    requestId: metadata.requestId,
    source: metadata.source,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

export function reportClientError(
  error: unknown,
  metadata: ClientErrorMetadata = {},
): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payloadFor(error, metadata));
  const endpoint = "/api/logs/client";

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
