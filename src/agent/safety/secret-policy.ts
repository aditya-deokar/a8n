import { AgentError } from "@/agent/errors";

/**
 * Secret detection for agent inputs.
 *
 * Rejects messages, tool arguments, or memory content that looks like
 * API keys, tokens, passwords, or webhook secrets. This is a defense-in-depth
 * layer — the MCP tools also have their own secret detection, but this catches
 * secrets before they reach the model or tools.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bsk-[a-zA-Z0-9]{20,}\b/, label: "OpenAI API key" },
  { pattern: /\bpk_(test|live)_[a-zA-Z0-9]{20,}\b/, label: "Stripe publishable key" },
  { pattern: /\bsk_(test|live)_[a-zA-Z0-9]{20,}\b/, label: "Stripe secret key" },
  { pattern: /\brk_(test|live)_[a-zA-Z0-9]{20,}\b/, label: "Stripe restricted key" },
  { pattern: /\bwhsec_[a-zA-Z0-9]{20,}\b/, label: "Stripe webhook secret" },
  { pattern: /\bxox[bpas]-[a-zA-Z0-9-]{20,}\b/, label: "Slack token" },
  { pattern: /\bglpat-[a-zA-Z0-9_-]{20,}\b/, label: "GitLab token" },
  { pattern: /\bghp_[a-zA-Z0-9]{36,}\b/, label: "GitHub personal access token" },
  { pattern: /\bghu_[a-zA-Z0-9]{36,}\b/, label: "GitHub user token" },
  { pattern: /\bghs_[a-zA-Z0-9]{36,}\b/, label: "GitHub server token" },
  { pattern: /\bAKIA[A-Z0-9]{16}\b/, label: "AWS access key" },
  { pattern: /\bASIA[A-Z0-9]{16}\b/, label: "AWS temporary key" },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?(?:PRIVATE |PUBLIC )?KEY-----/, label: "PEM key" },
  {
    pattern: /(?:password|secret|token|api_?key|private_?key|access_?key|auth_?token|bearer)\s*[:=]\s*["']?[^\s"']{8,}/i,
    label: "credential assignment",
  },
];

/**
 * Check if a string contains secret-looking content.
 * Returns the detected label or null if clean.
 */
export function detectSecret(value: string): string | null {
  for (const { pattern, label } of SECRET_PATTERNS) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}

/**
 * Assert that a value does not contain secrets.
 * Throws AgentError if a secret is detected.
 */
export function assertNoSecrets(
  value: string,
  context = "input",
): void {
  const detected = detectSecret(value);
  if (detected) {
    throw new AgentError(
      "AGENT_SAFETY_BLOCKED",
      `The ${context} appears to contain a ${detected}. ` +
        "Please use the credential settings to manage secrets instead of entering them in chat.",
    );
  }
}

/**
 * Check a record of key-value pairs for secrets.
 * Returns an array of fields that contain secret-looking values.
 */
export function detectSecretsInRecord(
  record: Record<string, unknown>,
): Array<{ field: string; label: string }> {
  const found: Array<{ field: string; label: string }> = [];

  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string") continue;
    const label = detectSecret(value);
    if (label) {
      found.push({ field: key, label });
    }
  }

  return found;
}
