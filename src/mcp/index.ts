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
import { MCP_CONFIG } from "./config";
import { registerAllTools } from "./tools/_registry";
import { registerAllResources } from "./resources/_registry";
import { registerAllPrompts } from "./prompts/_registry";
import type { McpAuthInfo } from "./auth/types";
import { getMcpAppProfile, type McpAppProfile } from "./app-profile";

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
 *   5. Declares the capabilities clients negotiate against
 *
 * @returns A ready-to-connect McpServer instance
 */
export function createMcpServer(
  authInfo?: McpAuthInfo,
  options: CreateMcpServerOptions = {},
): McpServer {
  const server = new McpServer(
    {
      name: MCP_CONFIG.SERVER_NAME,
      version: MCP_CONFIG.SERVER_VERSION,
    },
    {
      // McpServer infers tools/resources/prompts from what gets registered,
      // but `logging` is only wired up when declared here — without it
      // `logging/setLevel` answers -32601 and MCP Inspector's log-level
      // control fails.
      capabilities: {
        logging: {},
      },
    },
  );
  const appProfile = getMcpAppProfile(options.appProfile);

  // Register all capabilities. Widget resources are registered unconditionally
  // by the resource registry: the transport is stateless, so a per-request
  // server never observes the `initialize` handshake and cannot gate
  // registration on the client's advertised UI capability.
  registerAllTools(server, { authInfo, appProfile });
  registerAllResources(server, { authInfo, appProfile });
  registerAllPrompts(server);

  return server;
}
