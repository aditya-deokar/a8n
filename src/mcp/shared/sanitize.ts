/**
 * Output Sanitization
 *
 * Ensures that sensitive data (credential values, tokens, etc.)
 * is never included in MCP tool responses.
 */

/** Keys whose values should be redacted from any MCP response */
const REDACTED_KEYS = new Set([
  "value",       // Credential values (encrypted)
  "password",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "encryptionKey",
  "keyHash",     // API key hashes
]);

/**
 * Deep-sanitize an object, replacing sensitive field values with "[REDACTED]".
 * Works recursively on nested objects and arrays.
 */
export function sanitizeOutput<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeOutput(item)) as T;
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeOutput(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  return data;
}

/**
 * Build a standard MCP text content response from any data.
 * Automatically sanitizes sensitive fields.
 */
export function mcpJsonResponse(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(sanitizeOutput(data), null, 2),
      },
    ],
  };
}

/**
 * Build a plain text MCP response.
 */
export function mcpTextResponse(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}
