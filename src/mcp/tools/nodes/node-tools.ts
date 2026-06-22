/**
 * Node Tools — list_node_types
 * Scope: system:read
 *
 * Exposes the available node types and their metadata.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeType } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import type { McpAuthInfo } from "@/mcp/auth/types";

/** Metadata for each node type */
const NODE_TYPE_METADATA: Record<
  string,
  { category: string; description: string }
> = {
  INITIAL: {
    category: "system",
    description: "Placeholder start node. Added automatically to new workflows.",
  },
  MANUAL_TRIGGER: {
    category: "trigger",
    description: "Manually triggered entry point for a workflow.",
  },
  HTTP_REQUEST: {
    category: "action",
    description: "Make HTTP requests to external APIs.",
  },
  GOOGLE_FORM_TRIGGER: {
    category: "trigger",
    description: "Triggered when a Google Form submission is received.",
  },
  STRIPE_TRIGGER: {
    category: "trigger",
    description: "Triggered by Stripe webhook events (payments, subscriptions, etc.).",
  },
  ANTHROPIC: {
    category: "ai",
    description: "Generate text using Anthropic Claude models. Requires an ANTHROPIC credential.",
  },
  GEMINI: {
    category: "ai",
    description: "Generate text using Google Gemini models. Requires a GEMINI credential.",
  },
  OPENAI: {
    category: "ai",
    description: "Generate text using OpenAI GPT models. Requires an OPENAI credential.",
  },
  DISCORD: {
    category: "action",
    description: "Send messages to Discord channels via webhooks.",
  },
  SLACK: {
    category: "action",
    description: "Send messages to Slack channels via webhooks.",
  },
  EMAIL: {
    category: "action",
    description: "Send email through an SMTP credential.",
  },
  GOOGLE_SHEETS: {
    category: "action",
    description: "Append rows to Google Sheets using a service account credential.",
  },
};

export function registerListNodeTypes(server: McpServer) {
  server.tool(
    "list_node_types",
    "List all available node types that can be used in workflows. Includes category (trigger/action/ai/system) and description for each type.",
    {},
    async (_args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "system:read");

      return withErrorBoundary("list_node_types", async () => {
        const nodeTypes = Object.values(NodeType).map((type) => ({
          type,
          ...(NODE_TYPE_METADATA[type] || {
            category: "unknown",
            description: "No description available.",
          }),
        }));

        return mcpJsonResponse({
          nodeTypes,
          count: nodeTypes.length,
        });
      });
    },
  );
}
