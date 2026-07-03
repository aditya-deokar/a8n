import { AUTHZ_CASES } from "./authz-cases";
import { EXCESSIVE_AGENCY_CASES } from "./excessive-agency-cases";
import { EXFILTRATION_CASES } from "./exfiltration-cases";
import { PROMPT_INJECTION_CASES } from "./prompt-injection-cases";
import { SSRF_CASES } from "./ssrf-cases";
import { TOOL_POISONING_CASES } from "./tool-poisoning-cases";
import { WIDGET_CASES } from "./widget-cases";
import type { AdversarialCase } from "./types";

export const ADVERSARIAL_CASES: AdversarialCase[] = [
  ...PROMPT_INJECTION_CASES,
  ...EXFILTRATION_CASES,
  ...TOOL_POISONING_CASES,
  ...EXCESSIVE_AGENCY_CASES,
  ...SSRF_CASES,
  ...AUTHZ_CASES,
  ...WIDGET_CASES,
];

export * from "./types";
