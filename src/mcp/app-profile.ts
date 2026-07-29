export type McpAppProfile = "default" | "chatgpt" | "embedded_agent";

export function normalizeMcpAppProfile(value?: string | null): McpAppProfile {
  const normalized = value?.toLowerCase();
  if (normalized === "chatgpt") return "chatgpt";
  if (normalized === "embedded_agent") return "embedded_agent";
  return "default";
}

export function getMcpAppProfile(explicitProfile?: string | null): McpAppProfile {
  if (explicitProfile) {
    return normalizeMcpAppProfile(explicitProfile);
  }

  return normalizeMcpAppProfile(process.env.MCP_APP_PROFILE);
}

export function isChatGptAppProfile(profile?: McpAppProfile): boolean {
  return normalizeMcpAppProfile(profile) === "chatgpt";
}

export function isEmbeddedAgentProfile(profile?: McpAppProfile): boolean {
  return normalizeMcpAppProfile(profile) === "embedded_agent";
}
