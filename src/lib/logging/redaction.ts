const REDACTED = "[REDACTED]";
const MAX_DEPTH = 12;

const SENSITIVE_KEYS = new Set([
  "access_token",
  "accessToken",
  "api_key",
  "apiKey",
  "authorization",
  "bearer",
  "client_secret",
  "clientSecret",
  "code",
  "cookie",
  "database_url",
  "databaseUrl",
  "encryption_key",
  "encryptionKey",
  "id_token",
  "idToken",
  "key",
  "keyHash",
  "password",
  "private_key",
  "privateKey",
  "rawKey",
  "refresh_token",
  "refreshToken",
  "secret",
  "signature",
  "stripe-signature",
  "token",
  "value",
  "webhook_secret",
  "webhookSecret",
]);

const SENSITIVE_KEY_FRAGMENTS = [
  "authorization",
  "cookie",
  "credential",
  "privatekey",
  "private_key",
  "secret",
  "signature",
  "token",
  "webhook",
];

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]"],
  [/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/\bsk-(?:live|test|proj|ant)-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]"],
  [/\bwhsec_[A-Za-z0-9_]+\b/g, "[REDACTED_WEBHOOK_SECRET]"],
  [/\ba8n_mcp_[A-Za-z0-9._-]+\b/g, "[REDACTED_MCP_KEY]"],
  [/\ba8n_oauth_(?:at|rt|code)_[A-Za-z0-9._-]+\b/g, "[REDACTED_OAUTH_TOKEN]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED]"],
  [/(DATABASE_URL|ENCRYPTION_KEY|BETTER_AUTH_SECRET|POLAR_ACCESS_TOKEN|WEBHOOK_SECRET)=\S+/gi, "$1=[REDACTED]"],
];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function isSensitiveLogKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(key) ||
    SENSITIVE_KEYS.has(normalized) ||
    SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  );
}

export function redactLogString(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

function redactUrl(value: URL): string {
  const redacted = new URL(value.toString());
  if (redacted.username) redacted.username = REDACTED;
  if (redacted.password) redacted.password = REDACTED;

  for (const key of Array.from(redacted.searchParams.keys())) {
    if (isSensitiveLogKey(key)) redacted.searchParams.set(key, REDACTED);
  }

  return redactLogString(redacted.toString());
}

export function redactLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return redactLogString(value);
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return redactUrl(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactLogString(value.message),
    };
  }
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveLogKey(key) ? REDACTED : redactLogValue(item, depth + 1, seen),
    ]),
  );
}

export function redactLogFields<T extends Record<string, unknown>>(fields: T): T {
  return redactLogValue(fields) as T;
}

export function safeHeaders(headers: Headers | Record<string, string | undefined>) {
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      isSensitiveLogKey(key) ? REDACTED : redactLogString(value),
    ]),
  );
}

export function safeUrl(value: string): string {
  try {
    return redactUrl(new URL(value));
  } catch {
    return redactLogString(value);
  }
}
