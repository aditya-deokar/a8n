import type { PromptInjectionWarning } from "@/mcp/shared/safety";

export type SemanticSafetyLabel =
  | "instruction_override"
  | "secret_exfiltration"
  | "unsafe_tool_request"
  | "role_escalation"
  | "encoded_or_obfuscated_instruction";

export type SemanticSafetyFinding = {
  path: string;
  label: SemanticSafetyLabel;
  score: number;
  confidence: "low" | "medium" | "high";
  evidence: string;
};

const MAX_FINDINGS = 20;
const MAX_EVIDENCE_LENGTH = 180;

const LABEL_RULES: Array<{
  label: SemanticSafetyLabel;
  score: number;
  patterns: RegExp[];
}> = [
  {
    label: "instruction_override",
    score: 0.45,
    patterns: [
      /\b(disregard|bypass|override|ignore)\b.{0,80}\b(rule|instruction|policy|system|developer)\b/i,
      /\bdo not\b.{0,80}\b(follow|obey)\b.{0,80}\b(system|developer|policy|previous)\b/i,
    ],
  },
  {
    label: "secret_exfiltration",
    score: 0.55,
    patterns: [
      /\b(send|post|upload|exfiltrate|print|reveal|dump)\b.{0,90}\b(secret|token|password|credential|api key)\b/i,
      /\b(secret|token|password|credential|api key)\b.{0,90}\b(to|into)\b.{0,50}\b(http|webhook|attacker|external)\b/i,
    ],
  },
  {
    label: "unsafe_tool_request",
    score: 0.5,
    patterns: [
      /\b(call|run|invoke|execute)\b.{0,90}\b(delete_|revoke_|execute_workflow|create_api_key|update_credential)\b/i,
      /\bwithout\b.{0,80}\b(approval|confirmation|permission)\b/i,
    ],
  },
  {
    label: "role_escalation",
    score: 0.35,
    patterns: [
      /\byou are\b.{0,70}\b(root|owner|administrator|admin|developer mode)\b/i,
      /\bact as\b.{0,70}\b(system|developer|administrator|root)\b/i,
    ],
  },
  {
    label: "encoded_or_obfuscated_instruction",
    score: 0.3,
    patterns: [
      /\b(base64|rot13|unicode|zero-width|decode)\b.{0,120}\b(instruction|secret|token|delete|ignore)\b/i,
      /[\u200B-\u200D\uFEFF]/,
    ],
  },
];

function normalizeEvidence(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_EVIDENCE_LENGTH
    ? `${normalized.slice(0, MAX_EVIDENCE_LENGTH)}...`
    : normalized;
}

function confidence(score: number): SemanticSafetyFinding["confidence"] {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function scanText(value: string, path: string): SemanticSafetyFinding[] {
  const findings: SemanticSafetyFinding[] = [];
  const matchedLabels = new Set<SemanticSafetyLabel>();

  for (const rule of LABEL_RULES) {
    if (matchedLabels.has(rule.label)) continue;
    if (!rule.patterns.some((pattern) => pattern.test(value))) continue;
    matchedLabels.add(rule.label);
    findings.push({
      path,
      label: rule.label,
      score: rule.score,
      confidence: confidence(rule.score),
      evidence: normalizeEvidence(value),
    });
  }

  return findings;
}

function scanValue(
  value: unknown,
  path: string,
  findings: SemanticSafetyFinding[],
  seen: WeakSet<object>,
) {
  if (findings.length >= MAX_FINDINGS) return;

  if (typeof value === "string") {
    findings.push(...scanText(value, path));
    findings.splice(MAX_FINDINGS);
    return;
  }

  if (!value || typeof value !== "object" || value instanceof Date) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${path}[${index}]`, findings, seen));
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    scanValue(nested, path ? `${path}.${key}` : key, findings, seen);
    if (findings.length >= MAX_FINDINGS) return;
  }
}

export function classifySemanticSafety(
  value: unknown,
  warnings: PromptInjectionWarning[] = [],
): SemanticSafetyFinding[] {
  const findings: SemanticSafetyFinding[] = [];
  scanValue(value, "", findings, new WeakSet<object>());

  const warningBackfilledFindings = warnings.map((warning): SemanticSafetyFinding => {
    const label: SemanticSafetyLabel =
      warning.pattern === "secret-exfiltration"
        ? "secret_exfiltration"
        : warning.pattern === "tool-coercion"
          ? "unsafe_tool_request"
          : warning.pattern === "encoded-instruction"
            ? "encoded_or_obfuscated_instruction"
            : warning.pattern === "admin-escalation"
              ? "role_escalation"
              : "instruction_override";
    const score =
      label === "secret_exfiltration" || label === "unsafe_tool_request"
        ? 0.85
        : 0.7;
    return {
      path: warning.path,
      label,
      score,
      confidence: confidence(score),
      evidence: warning.snippet,
    };
  });

  const unique = new Map<string, SemanticSafetyFinding>();
  for (const finding of [...warningBackfilledFindings, ...findings]) {
    const key = `${finding.path}:${finding.label}`;
    const previous = unique.get(key);
    if (!previous || finding.score > previous.score) unique.set(key, finding);
  }

  return [...unique.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FINDINGS);
}
