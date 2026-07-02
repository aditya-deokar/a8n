import type { McpScope } from "@/mcp/auth/scopes";

export type McpToolRisk =
  | "read_only"
  | "draft_write"
  | "approval_gated_write"
  | "external_side_effect"
  | "repair_write"
  | "admin_or_destructive";

export type McpToolPolicy = {
  risk: McpToolRisk;
  requiresApproval: boolean;
  chatGptMvp: boolean;
  note: string;
};

export type McpToolProfile = "default" | "chatgpt";

export type McpToolDomain =
  | "api_keys"
  | "credentials"
  | "executions"
  | "integrations"
  | "nodes"
  | "system"
  | "workflows"
  | "apps";

export type McpToolContract = {
  name: string;
  domain: McpToolDomain;
  source: string;
  profiles: McpToolProfile[];
  requiredScopes: McpScope[];
  risk: McpToolRisk;
  requiresApproval: boolean;
  externalSideEffect: boolean;
  destructive: boolean;
  admin: boolean;
  forbiddenInChatGpt: boolean;
  outputSchema: string;
  nativeOutputSchema: boolean;
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  note: string;
  exampleInput: Record<string, unknown>;
};

export type McpResourceProfile = "default" | "chatgpt";

export type McpResourceContract = {
  name: string;
  uri: string;
  profiles: McpResourceProfile[];
  kind: "resource" | "template" | "widget";
  mimeType: string;
  requiredScopes: McpScope[];
  modelVisible: boolean;
  widgetOnly: boolean;
  note: string;
};

export type McpPromptContract = {
  name: string;
  source: string;
  requiredTools: string[];
  requiredResources: string[];
  asksForSecretsInChat: boolean;
  handlesUntrustedContent: boolean;
  note: string;
};
