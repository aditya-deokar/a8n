/**
 * n8n MCP Server Factory
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

/**
 * Create a fully configured MCP server instance.
 *
 * This function:
 *   1. Instantiates the McpServer with server metadata
 *   2. Registers all tools (workflows, credentials, executions, etc.)
 *   3. Registers all resources (schemas, docs)
 *   4. Registers all prompts (guided templates)
 *
 * @returns A ready-to-connect McpServer instance
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_CONFIG.SERVER_NAME,
    version: MCP_CONFIG.SERVER_VERSION,
  });

  // Register all capabilities
  registerAllTools(server);
  registerAllResources(server);
  registerAllPrompts(server);

  return server;
}
