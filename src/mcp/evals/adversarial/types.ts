export type AdversarialCategory =
  | "prompt_injection"
  | "tool_poisoning"
  | "exfiltration"
  | "excessive_agency"
  | "ssrf"
  | "authz"
  | "widget";

export type AdversarialBaseCase = {
  id: string;
  category: AdversarialCategory;
  title: string;
  severity: "p0" | "p1" | "p2";
};

export type PromptInjectionCase = AdversarialBaseCase & {
  category: "prompt_injection";
  payload: unknown;
  expectedPatterns: string[];
};

export type ExfiltrationCase = AdversarialBaseCase & {
  category: "exfiltration";
  payload: unknown;
  forbiddenSubstrings: string[];
  expectedPatterns?: string[];
};

export type ToolPoisoningCase = AdversarialBaseCase & {
  category: "tool_poisoning";
  toolName: string;
  descriptor: string;
  expectedForbidden?: boolean;
  expectedRequiresApproval?: boolean;
  expectedPatterns?: string[];
};

export type ExcessiveAgencyCase = AdversarialBaseCase & {
  category: "excessive_agency";
  userRequest: string;
  toolName: string;
  approved: boolean;
  confirmationHash?: string;
  confirmationPayload?: unknown;
  expectedBlocked: boolean;
};

export type SsrfCase = AdversarialBaseCase & {
  category: "ssrf";
  url: string;
  expectedAllowed: boolean;
  expectedReason: string;
};

export type AuthzCase = AdversarialBaseCase & {
  category: "authz";
  toolName: string;
  profile: "chatgpt" | "default";
  expectedAllowed: boolean;
  expectedRequiresApproval?: boolean;
};

export type WidgetCase = AdversarialBaseCase & {
  category: "widget";
  payload: unknown;
  forbiddenSubstrings: string[];
  expectedPatterns?: string[];
};

export type AdversarialCase =
  | PromptInjectionCase
  | ExfiltrationCase
  | ToolPoisoningCase
  | ExcessiveAgencyCase
  | SsrfCase
  | AuthzCase
  | WidgetCase;
