/**
 * Memory extraction policy.
 *
 * Deterministic filter that decides whether an agent-proposed memory
 * fact should be stored, rejected, or needs explicit user consent.
 *
 * This is NOT a model-based filter — it is a hard policy layer that
 * runs after the model proposes memories and before they are written
 * to the vector store.
 */

import { redactMemoryContent, containsSecretPatterns } from "./redaction";

export type ExtractionDecision = "allowed" | "rejected" | "needs_consent";

export type ExtractionResult = {
  decision: ExtractionDecision;
  reason: string;
  redactedContent: string | null;
};

/**
 * Maximum allowed length for a single memory fact.
 */
const MAX_MEMORY_LENGTH = 2_000;

/**
 * Minimum meaningful content length.
 */
const MIN_MEMORY_LENGTH = 5;

/**
 * Patterns that indicate the content is a raw message transcript
 * rather than a distilled fact.
 */
const TRANSCRIPT_PATTERNS = [
  /^(user|assistant|human|ai|system)\s*:/im,
  /\n(user|assistant|human|ai|system)\s*:/im,
  /^```/m, // code blocks are usually not useful memories
];

/**
 * Patterns that indicate credential / secret content that must be rejected.
 */
const SECRET_INDICATOR_PATTERNS = [
  /\b(api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token|bearer|password|private[_-]?key|webhook[_-]?secret)\b/i,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bghp_[a-zA-Z0-9]{10,}\b/,
  /\bxox[bp]-/,
  /\bAKIA[A-Z0-9]{8,}\b/,
];

/**
 * PII patterns that must be rejected outright.
 */
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/, // Email
];

/**
 * Evaluate whether a proposed memory fact should be stored.
 */
export function evaluateMemoryExtraction(
  proposedContent: string,
): ExtractionResult {
  const content = proposedContent.trim();

  // --- Length checks ---
  if (content.length < MIN_MEMORY_LENGTH) {
    return {
      decision: "rejected",
      reason: "Content too short to be a useful memory.",
      redactedContent: null,
    };
  }

  if (content.length > MAX_MEMORY_LENGTH) {
    return {
      decision: "rejected",
      reason: `Content exceeds maximum length of ${MAX_MEMORY_LENGTH} characters.`,
      redactedContent: null,
    };
  }

  // --- Hard reject: secrets ---
  for (const pattern of SECRET_INDICATOR_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: "rejected",
        reason: "Content appears to contain credentials or secret values.",
        redactedContent: null,
      };
    }
  }

  // --- Hard reject: PII ---
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: "rejected",
        reason: "Content appears to contain personally identifiable information.",
        redactedContent: null,
      };
    }
  }

  // --- Hard reject: raw transcripts ---
  for (const pattern of TRANSCRIPT_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: "rejected",
        reason: "Content appears to be a raw message transcript, not a distilled fact.",
        redactedContent: null,
      };
    }
  }

  // --- Redact any remaining subtle patterns ---
  const redacted = redactMemoryContent(content);
  if (!redacted) {
    return {
      decision: "rejected",
      reason: "Content was entirely redacted — no meaningful information remains.",
      redactedContent: null,
    };
  }

  // --- If redaction changed the content significantly, flag for review ---
  if (containsSecretPatterns(content) && redacted !== content) {
    return {
      decision: "rejected",
      reason: "Content contained secret-like patterns that were redacted.",
      redactedContent: null,
    };
  }

  return {
    decision: "allowed",
    reason: "Content passes all policy checks.",
    redactedContent: redacted,
  };
}
