/**
 * Memory content redaction.
 *
 * Sanitizes text before it reaches the embedding provider or the vector store.
 * Strips patterns that look like secrets, auth tokens, or personally
 * identifiable information that should never be persisted in memory.
 */

/**
 * Patterns that are stripped from memory content before storage.
 * Each entry has a regex and a replacement placeholder.
 */
const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys / tokens (common prefixes)
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /\b(pk-[a-zA-Z0-9]{20,})\b/g, replacement: "[REDACTED_API_KEY]" },
  { pattern: /\b(ghp_[a-zA-Z0-9]{36,})\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\b(gho_[a-zA-Z0-9]{36,})\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\b(xoxb-[a-zA-Z0-9-]{20,})\b/g, replacement: "[REDACTED_SLACK_TOKEN]" },
  { pattern: /\b(xoxp-[a-zA-Z0-9-]{20,})\b/g, replacement: "[REDACTED_SLACK_TOKEN]" },
  { pattern: /\b(AKIA[A-Z0-9]{12,})\b/g, replacement: "[REDACTED_AWS_KEY]" },
  { pattern: /\b(ya29\.[a-zA-Z0-9_-]{30,})\b/g, replacement: "[REDACTED_GOOGLE_TOKEN]" },

  // Bearer tokens in text
  { pattern: /Bearer\s+[a-zA-Z0-9._\-\/+=]{20,}/gi, replacement: "Bearer [REDACTED]" },

  // Authorization headers
  { pattern: /Authorization:\s*\S+/gi, replacement: "Authorization: [REDACTED]" },

  // Base64-encoded blobs (likely encoded secrets, >= 40 chars)
  { pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, replacement: "[REDACTED_ENCODED]" },

  // URLs with auth tokens in query params
  { pattern: /(https?:\/\/[^\s]*[?&](token|key|secret|api_key|apikey|access_token|auth)=)[^\s&]*/gi, replacement: "$1[REDACTED]" },

  // Email addresses
  { pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: "[REDACTED_EMAIL]" },

  // Credit card numbers (simple pattern)
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[REDACTED_CARD]" },

  // SSN-like patterns
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED_SSN]" },

  // Password-like assignments
  { pattern: /password\s*[:=]\s*\S+/gi, replacement: "password: [REDACTED]" },
  { pattern: /secret\s*[:=]\s*\S+/gi, replacement: "secret: [REDACTED]" },
];

/**
 * Redact sensitive patterns from memory content.
 *
 * @returns The redacted string. If the redacted content is empty or only
 *          contains redaction placeholders, returns `null` to signal
 *          the memory should be discarded entirely.
 */
export function redactMemoryContent(content: string): string | null {
  let redacted = content;
  let redactionCount = 0;

  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    const before = redacted;
    redacted = redacted.replace(pattern, replacement);
    if (redacted !== before) redactionCount++;
  }

  // Trim and check if meaningful content remains
  redacted = redacted.trim();

  if (!redacted) return null;

  // If more than half the content was redacted, discard entirely
  const placeholderCount = (redacted.match(/\[REDACTED[^\]]*\]/g) || []).length;
  const wordCount = redacted.split(/\s+/).length;
  if (placeholderCount > 0 && placeholderCount >= wordCount / 2) {
    return null;
  }

  return redacted;
}

/**
 * Check if a string contains any patterns that look like secrets.
 * Returns true if the content appears to contain sensitive data.
 */
export function containsSecretPatterns(content: string): boolean {
  return REDACTION_PATTERNS.some(({ pattern }) => {
    // Clone the regex to avoid stale lastIndex
    const fresh = new RegExp(pattern.source, pattern.flags);
    return fresh.test(content);
  });
}
