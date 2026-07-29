/**
 * Clarification policy for the embedded agent.
 *
 * Implements the spec's rules:
 * - Ask the smallest number of questions that unblock a valid draft
 * - Group independent low-risk questions into one message
 * - Never ask for secrets in chat
 * - If a required secret-backed integration is missing, ask the user to select
 *   or create a credential through the credential UI
 * - State assumptions explicitly and make them editable in the draft
 * - Stop planning when the user's intent is ambiguous rather than guessing
 */

const SECRET_LOOKING_PATTERNS = [
  /(?:^|[\s"'=:])(?:sk-|pk_|rk_|whsec_|xox[bpas]-|glpat-|ghp_|ghu_|ghs_|AKIA|ASIA)/i,
  /(?:^|[\s"'=:])(?:[a-zA-Z0-9+/]{40,}={0,2})$/,
  /(?:password|secret|token|api_?key|private_?key|access_?key|auth_?token|bearer)\s*[:=]\s*.{8,}/i,
  /-----BEGIN (?:RSA |EC |DSA )?(?:PRIVATE |PUBLIC )?KEY-----/,
];

/**
 * Check if a value looks like it might be a secret/credential.
 */
export function looksLikeSecret(value: string): boolean {
  return SECRET_LOOKING_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Validate answers before they are sent to answer_workflow_draft_questions.
 * Returns an array of rejected field names with reasons.
 */
export function validateDraftAnswers(
  answers: Record<string, string>,
): { field: string; reason: string }[] {
  const rejected: { field: string; reason: string }[] = [];

  for (const [field, value] of Object.entries(answers)) {
    if (typeof value !== "string") continue;

    if (looksLikeSecret(value)) {
      rejected.push({
        field,
        reason:
          "This value looks like a secret (API key, token, password). Please use the credential settings to configure secrets instead of entering them in chat.",
      });
    }
  }

  return rejected;
}

/**
 * Group independent questions into a compact message.
 * Returns a formatted message string.
 */
export function formatClarifications(questions: string[]): string {
  if (questions.length === 0) return "";
  if (questions.length === 1) return questions[0];

  return [
    "I need a few details to proceed:",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
  ].join("\n");
}

/**
 * Check if a user message contains any explicit secret-like content
 * that should be rejected before it reaches the model or tools.
 */
export function containsSecretContent(message: string): boolean {
  return looksLikeSecret(message);
}
