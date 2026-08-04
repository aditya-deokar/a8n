/**
 * Capability Guard
 *
 * Utilities for detecting MCP client capabilities, specifically whether
 * the connecting client supports interactive MCP Apps UIs via the
 * `@modelcontextprotocol/ext-apps` specification.
 */

import {
  getUiCapability,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isChatGptAppProfile, isEmbeddedAgentProfile } from "@/mcp/app-profile";

/**
 * Determine whether the client supports MCP Apps UI rendering.
 *
 * UI capabilities are enabled if:
 * 1. The explicit appProfile is 'chatgpt' or 'embedded_agent' (both support UI widgets)
 * 2. The client advertises the `io.modelcontextprotocol/ui` capability extension
 *    with support for `text/html;profile=mcp-app` (`RESOURCE_MIME_TYPE`).
 *
 * @param server - The McpServer instance
 * @param appProfile - Optional profile name ('chatgpt', 'embedded_agent', 'default')
 * @returns true if the client supports UI widgets, false for text-only clients
 */
export function hasUiCapability(
  server: McpServer,
  appProfile?: string | null,
): boolean {
  if (isChatGptAppProfile(appProfile) || isEmbeddedAgentProfile(appProfile)) {
    return true;
  }

  try {
    const rawServer = server.server as unknown as {
      getClientCapabilities?: () => unknown;
    };
    if (typeof rawServer?.getClientCapabilities === "function") {
      const caps = rawServer.getClientCapabilities();
      const uiCap = getUiCapability(
        caps as Parameters<typeof getUiCapability>[0],
      );
      if (uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE)) {
        return true;
      }
    }
  } catch {
    // If client capabilities are not yet initialized or unavailable
  }

  return false;
}
