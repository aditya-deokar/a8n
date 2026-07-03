/**
 * Output Sanitization
 *
 * Ensures that sensitive data (credential values, tokens, etc.)
 * is never included in MCP tool responses.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safetyMetaForOutput } from "./safety";
import { recordMcpRuntimeEvent } from "@/mcp/observability/runtime-guardrails";

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

const REDACTED_KEY_FRAGMENTS = [
  "authorization",
  "cookie",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
  "webhooksecret",
  "webhook_secret",
  "stripe-signature",
];

function isRedactedKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return (
    REDACTED_KEYS.has(key) ||
    REDACTED_KEYS.has(normalized) ||
    REDACTED_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  );
}

function redactSensitiveString(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, "[REDACTED_SCRIPT]")
    .replace(/\bjavascript\s*:/gi, "[REDACTED_JAVASCRIPT_SCHEME]:")
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_API_KEY]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b/gi, "$1[REDACTED_TOKEN]");
}

function promptInjectionWarningPatterns(safety: Record<string, unknown>): string[] {
  const warnings = Array.isArray(safety.promptInjectionWarnings)
    ? safety.promptInjectionWarnings
    : [];
  return warnings.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const pattern = (warning as { pattern?: unknown }).pattern;
    return typeof pattern === "string" ? [pattern] : [];
  });
}

/**
 * Deep-sanitize an object, replacing sensitive field values with "[REDACTED]".
 * Works recursively on nested objects and arrays.
 */
export function sanitizeOutput<T>(data: T): T {
  if (data === null || data === undefined) return data;

  if (data instanceof Date) {
    return data.toISOString() as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeOutput(item)) as T;
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isRedactedKey(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeOutput(value);
      } else if (typeof value === "string") {
        sanitized[key] = redactSensitiveString(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  if (typeof data === "string") {
    return redactSensitiveString(data) as T;
  }

  return data;
}

/**
 * Build a standard MCP text content response from any data.
 * Automatically sanitizes sensitive fields.
 */
export function mcpJsonResponse(data: unknown): CallToolResult {
  const sanitized = sanitizeOutput(data);
  const structuredContent =
    sanitized !== null && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : { result: sanitized };

  const safety = safetyMetaForOutput(sanitized);
  if (safety?.untrustedContentDetected) {
    const patterns = promptInjectionWarningPatterns(safety);
    recordMcpRuntimeEvent({
      type: "prompt_injection_warning",
      status: "warning",
      count: patterns.length || 1,
      error: patterns.join(", "),
    });
  }

  return {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(sanitized, null, 2),
      },
    ],
    ...(safety ? { _meta: { safety } } : {}),
  };
}

/**
 * Build a plain text MCP response.
 */
export function mcpTextResponse(message: string): CallToolResult {
  const safety = safetyMetaForOutput(message);
  if (safety?.untrustedContentDetected) {
    const patterns = promptInjectionWarningPatterns(safety);
    recordMcpRuntimeEvent({
      type: "prompt_injection_warning",
      status: "warning",
      count: patterns.length || 1,
      error: patterns.join(", "),
    });
  }

  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    ...(safety ? { _meta: { safety } } : {}),
  };
}
