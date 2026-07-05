import { logger, redactLogString, safeUrl, withRequestLogging } from "@/lib/logging";
import { z } from "zod";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_EVENTS_PER_WINDOW = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

type ClientLogBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, ClientLogBucket>();

const clientLogSchema = z.object({
  errorName: z.string().optional(),
  message: z.string().optional(),
  digest: z.string().optional(),
  path: z.string().optional(),
  source: z.string().optional(),
  userAgent: z.string().optional(),
  requestId: z.string().optional(),
});

function enabled() {
  return process.env.OBSERVABILITY_CLIENT_LOG_ENABLED !== "false";
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(request: Request) {
  const key = requestIp(request);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= MAX_EVENTS_PER_WINDOW;
}

function safeText(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  const redacted = redactLogString(value).trim();
  return redacted.length > maxLength ? redacted.slice(0, maxLength) : redacted;
}

function safePath(value: string | undefined) {
  if (!value) return undefined;

  try {
    return value.startsWith("/")
      ? safeUrl(`https://client.local${value}`).replace("https://client.local", "")
      : safeUrl(value);
  } catch {
    return safeText(value, 500);
  }
}

async function postHandler(request: Request): Promise<Response> {
  if (!enabled()) return new Response(null, { status: 204 });
  if (!checkRateLimit(request)) {
    return Response.json({ success: false, error: "rate_limited" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ success: false, error: "payload_too_large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return Response.json({ success: false, error: "payload_too_large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const result = clientLogSchema.safeParse(parsed);
  if (!result.success) {
    return Response.json({ success: false, error: "invalid_payload" }, { status: 400 });
  }

  const payload = result.data;
  const userAgent =
    safeText(payload.userAgent, 500) ||
    safeText(request.headers.get("user-agent") || undefined, 500);

  logger.warn(
    {
      component: "client",
      event: "client_error_reported",
      errorName: safeText(payload.errorName, 120) || "ClientError",
      safeMessage: safeText(payload.message, 600),
      digest: safeText(payload.digest, 160),
      path: safePath(payload.path),
      source: safeText(payload.source, 120),
      userAgent,
      requestId: safeText(payload.requestId, 160) || request.headers.get("x-request-id") || undefined,
    },
    "Client error reported.",
  );

  return Response.json({ success: true }, { status: 202 });
}

export const POST = withRequestLogging(postHandler, {
  component: "client",
  route: "/api/logs/client",
  eventPrefix: "client_log_request",
});
