/**
 * a8n MCP Server Factory
 *
 * Creates and configures the McpServer instance with all registered
 * tools, resources, and prompts. This is the central entry point
 * for the MCP server module.
 *
 * The server is stateless — a new instance is created per request
 * via the Streamable HTTP transport in the API route.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getUiCapability,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { MCP_CONFIG } from "./config";
import { registerAllTools } from "./tools/_registry";
import { registerAllResources } from "./resources/_registry";
import { registerAllPrompts } from "./prompts/_registry";
import { registerChatGptWidgetResources } from "./apps/widget-resources";
import type { McpAuthInfo } from "./auth/types";
import { getMcpAppProfile, type McpAppProfile } from "./app-profile";
import { logger } from "@/lib/logging";

export interface CreateMcpServerOptions {
  appProfile?: McpAppProfile;
}

/**
 * Create a fully configured MCP server instance.
 *
 * This function:
 *   1. Instantiates the McpServer with server metadata
 *   2. Registers all tools (workflows, credentials, executions, etc.)
 *   3. Registers all resources (schemas, docs)
 *   4. Registers all prompts (guided templates)
 *   5. Listens for client initialization handshake to enable MCP Apps UIs dynamically
 *
 * @returns A ready-to-connect McpServer instance
 */
export function createMcpServer(
  authInfo?: McpAuthInfo,
  options: CreateMcpServerOptions = {},
): McpServer {
  const server = new McpServer({
    name: MCP_CONFIG.SERVER_NAME,
    version: MCP_CONFIG.SERVER_VERSION,
  });
  const appProfile = getMcpAppProfile(options.appProfile);

  // Register all capabilities
  registerAllTools(server, { authInfo, appProfile });
  registerAllResources(server, { authInfo, appProfile });
  registerAllPrompts(server);

  // Listen for client initialization handshake to detect UI capability
  try {
    const rawServer = server.server as unknown as {
      oninitialized?: () => void;
      getClientCapabilities?: () => unknown;
    };
    const prevOnInitialized = rawServer.oninitialized;
    rawServer.oninitialized = () => {
      if (typeof prevOnInitialized === "function") {
        prevOnInitialized();
      }
      const caps = rawServer.getClientCapabilities?.();
      const uiCap = getUiCapability(
        caps as Parameters<typeof getUiCapability>[0],
      );
      if (uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE)) {
        registerChatGptWidgetResources(server);
        logger.info(
          { component: "mcp", event: "mcp_ui_capability_detected" },
          "Client capability io.modelcontextprotocol/ui detected; widget resources enabled.",
        );
      }
    };
  } catch {
    // Non-blocking capability listener hook
  }

  return server;
}
