export type McpAppProfile = "default" | "chatgpt";

export function normalizeMcpAppProfile(value?: string | null): McpAppProfile {
  return value?.toLowerCase() === "chatgpt" ? "chatgpt" : "default";
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
