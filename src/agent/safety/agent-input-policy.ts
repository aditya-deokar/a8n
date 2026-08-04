/**
 * Agent input policy — adversarial hardening.
 *
 * Comprehensive input sanitization layer that runs before the model
 * sees any user message. Detects prompt injection, enforces length
 * limits, strips dangerous characters, and catches nested injection
 * attempts.
 *
 * This is a defense-in-depth layer alongside secret-policy.ts.
 */

import { AgentError } from "@/agent/errors";
import { recordAgentMetric, AGENT_METRICS } from "@/agent/observability/metrics";

/**
 * Maximum allowed input message length (characters).
 */
const MAX_INPUT_LENGTH = 10_000;

/**
 * Prompt injection detection patterns.
 *
 * These cover common adversarial techniques:
 * - Role override attempts
 * - System prompt extraction
 * - Instruction override/ignore patterns
 * - Jailbreak delimiters
 * - Encoded injection payloads
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Direct instruction override
  {
    pattern: /\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|above|prior|earlier|system)\s+(?:instructions?|prompts?|rules?|constraints?|guidelines?)/i,
    label: "instruction_override",
  },
  // Role override attempts
  {
    pattern: /\b(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you\s+are)|switch\s+(?:to|into)\s+(?:a|the)?)\s+(?:different|new|unrestricted|unfiltered|evil|DAN|jailbroken)/i,
    label: "role_override",
  },
  // System prompt extraction
  {
    pattern: /\b(?:show|reveal|print|output|display|repeat|echo|leak|expose)\s+(?:your|the|my)?\s*(?:system\s+(?:prompt|message|instructions?)|initial\s+(?:prompt|instructions?))/i,
    label: "system_prompt_extraction",
  },
  // Common jailbreak delimiters
  {
    pattern: /\[(?:SYSTEM|INST|SYS)\]|\<\|(?:system|im_start|endoftext)\|\>/i,
    label: "jailbreak_delimiter",
  },
  // "Do anything now" jailbreak
  {
    pattern: /\bDAN\s+(?:mode|prompt|jailbreak)\b|\bDo\s+Anything\s+Now\b/i,
    label: "dan_jailbreak",
  },
  // Markdown/XML injection to override context
  {
    pattern: /^```(?:system|instructions?|config|override)\s*$/im,
    label: "markdown_injection",
  },
  // Direct model manipulation
  {
    pattern: /\b(?:your\s+(?:new|real|true|actual)\s+(?:instructions?|rules?|purpose|goal)\s+(?:is|are))\b/i,
    label: "model_manipulation",
  },
  // "From now on" resets
  {
    pattern: /\b(?:from\s+(?:now|this\s+point)\s+on|henceforth|going\s+forward)\s*,?\s*(?:you\s+(?:will|must|should|are)|ignore|disregard)/i,
    label: "instruction_reset",
  },
  // Developer mode / debug mode
  {
    pattern: /\b(?:enter|enable|activate|switch\s+to)\s+(?:developer|debug|admin|maintenance|god)\s+mode\b/i,
    label: "privilege_escalation",
  },
];

/**
 * Control characters and null bytes to strip.
 */
const DANGEROUS_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Homoglyph-style Unicode attack characters.
 * These look like ASCII characters but are different Unicode codepoints.
 */
const HOMOGLYPH_PATTERNS = [
  /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, // Zero-width and invisible chars
  /[\uFF01-\uFF5E]/g, // Fullwidth ASCII variants
];

export type InputPolicyResult = {
  safe: boolean;
  sanitized: string;
  rejections: Array<{ type: string; label: string; detail?: string }>;
};

/**
 * Evaluate user input against the agent input policy.
 *
 * Returns a result with the sanitized input and any rejections.
 * If rejections are present, the input should be blocked.
 */
export function evaluateAgentInput(rawInput: string): InputPolicyResult {
  const rejections: InputPolicyResult["rejections"] = [];

  // --- Step 1: Length check ---
  if (rawInput.length > MAX_INPUT_LENGTH) {
    rejections.push({
      type: "length_exceeded",
      label: "Input too long",
      detail: `Message length ${rawInput.length} exceeds maximum ${MAX_INPUT_LENGTH} characters.`,
    });
  }

  // --- Step 2: Sanitize dangerous characters ---
  let sanitized = rawInput.replace(DANGEROUS_CHARS, "");

  // Strip invisible Unicode characters
  for (const pattern of HOMOGLYPH_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // --- Step 3: Check for prompt injection patterns ---
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      rejections.push({
        type: "prompt_injection",
        label,
        detail: `Detected adversarial pattern: ${label}.`,
      });
    }
  }

  // --- Step 4: Check for nested injection in encoded content ---
  const nestedInjection = detectNestedInjection(sanitized);
  if (nestedInjection) {
    rejections.push({
      type: "nested_injection",
      label: nestedInjection,
      detail: `Detected injection attempt in encoded content: ${nestedInjection}.`,
    });
  }

  return {
    safe: rejections.length === 0,
    sanitized: sanitized.slice(0, MAX_INPUT_LENGTH),
    rejections,
  };
}

/**
 * Assert that user input passes the agent input policy.
 *
 * @throws {AgentError} with code AGENT_SAFETY_BLOCKED if the input fails.
 */
export function assertAgentInputSafe(rawInput: string): string {
  const result = evaluateAgentInput(rawInput);

  if (!result.safe) {
    const reasons = result.rejections.map((r) => r.label).join(", ");

    recordAgentMetric(AGENT_METRICS.SAFETY_BLOCKED, 1, {
      rejections: result.rejections.map((r) => r.type),
    });

    throw new AgentError(
      "AGENT_SAFETY_BLOCKED",
      `Your message was blocked by the safety policy: ${reasons}. Please rephrase your request.`,
    );
  }

  return result.sanitized;
}

/**
 * Detect injection attempts hidden in encoded content.
 *
 * Checks for base64-encoded strings or URL-encoded strings that
 * contain injection patterns when decoded.
 */
function detectNestedInjection(input: string): string | null {
  // Check base64 blobs (40+ chars, likely encoded payload)
  const base64Matches = input.match(/[A-Za-z0-9+/]{40,}={0,2}/g);
  if (base64Matches) {
    for (const match of base64Matches.slice(0, 5)) {
      try {
        const decoded = Buffer.from(match, "base64").toString("utf8");
        // Only check if the decoded content is readable ASCII
        if (/^[\x20-\x7E\s]+$/.test(decoded)) {
          for (const { pattern, label } of INJECTION_PATTERNS) {
            if (pattern.test(decoded)) {
              return `base64_${label}`;
            }
          }
        }
      } catch {
        // Not valid base64 — skip
      }
    }
  }

  // Check URL-encoded content
  if (input.includes("%20") || input.includes("%3C") || input.includes("%22")) {
    try {
      const decoded = decodeURIComponent(input);
      if (decoded !== input) {
        for (const { pattern, label } of INJECTION_PATTERNS) {
          if (pattern.test(decoded) && !pattern.test(input)) {
            return `url_encoded_${label}`;
          }
        }
      }
    } catch {
      // Invalid URL encoding — skip
    }
  }

  return null;
}
