import type { McpAuthInfo } from "@/mcp/auth/types";
import type { McpAppProfile } from "@/mcp/app-profile";

export interface McpToolContext {
  authInfo?: McpAuthInfo;
  appProfile?: McpAppProfile;
}

export function getMcpAuth(
  extra: unknown,
  context: McpToolContext = {},
): McpAuthInfo {
  const extraAuth =
    extra && typeof extra === "object"
      ? ((extra as { authInfo?: McpAuthInfo }).authInfo)
      : undefined;

  const auth = extraAuth ?? context.authInfo;

  if (!auth) {
    throw new Error(
      "Authentication context missing. Reconnect with a valid Bearer token and try again.",
    );
  }

  return auth;
}
