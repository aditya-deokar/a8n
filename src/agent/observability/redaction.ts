/**
 * Agent log redaction.
 *
 * Strips prompts, raw model responses, credentials, authorization
 * headers, and other sensitive data from log payloads before they
 * reach the observability pipeline.
 */

/**
 * Keys that should always be fully redacted in logs.
 */
const REDACTED_KEYS = new Set([
  "prompt",
  "systemPrompt",
  "system_prompt",
  "rawResponse",
  "raw_response",
  "apiKey",
  "api_key",
  "secretKey",
  "secret_key",
  "accessToken",
  "access_token",
  "authorization",
  "bearerToken",
  "bearer_token",
  "password",
  "credential",
  "credentialValue",
  "webhookSecret",
  "webhook_secret",
  "privateKey",
  "private_key",
]);

/**
 * Keys whose values should be truncated (not fully redacted).
 */
const TRUNCATED_KEYS = new Set([
  "messages",
  "content",
  "text",
  "response",
  "output",
  "input",
  "toolOutput",
  "tool_output",
  "toolInput",
  "tool_input",
]);

const MAX_TRUNCATED_LENGTH = 200;

/**
 * Redact an agent log payload object.
 *
 * Returns a new object with sensitive fields replaced and large
 * text fields truncated. Does not mutate the input.
 */
export function redactAgentLog(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Fully redact sensitive keys
    if (REDACTED_KEYS.has(key) || REDACTED_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
      continue;
    }

    // Check if the key contains sensitive substrings
    if (
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("apikey") ||
      lowerKey.includes("token") && !lowerKey.includes("tokencount")
    ) {
      result[key] = "[REDACTED]";
      continue;
    }

    // Truncate large text fields
    if (TRUNCATED_KEYS.has(key) || TRUNCATED_KEYS.has(lowerKey)) {
      if (typeof value === "string" && value.length > MAX_TRUNCATED_LENGTH) {
        result[key] = value.slice(0, MAX_TRUNCATED_LENGTH) + `...[${value.length} chars]`;
        continue;
      }
      if (Array.isArray(value)) {
        result[key] = `[Array(${value.length})]`;
        continue;
      }
    }

    // Recursively redact nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactAgentLog(value as Record<string, unknown>);
      continue;
    }

    // Truncate any overly long string values
    if (typeof value === "string" && value.length > 1000) {
      result[key] = value.slice(0, 1000) + `...[${value.length} chars]`;
      continue;
    }

    result[key] = value;
  }

  return result;
}
