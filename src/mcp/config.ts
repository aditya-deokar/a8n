/**
 * MCP Server Configuration
 *
 * Central configuration for the a8n MCP server including
 * server metadata, rate limiting, and security settings.
 */

export const MCP_CONFIG = {
  /** Server identification */
  SERVER_NAME: "a8n-mcp-server",
  SERVER_VERSION: "1.0.0",
  SERVER_DESCRIPTION:
    "a8n Workflow Automation Platform — MCP Server for managing workflows, credentials, executions, and nodes via AI-powered clients.",

  /** Endpoint */
  ENDPOINT_PATH: "/api/mcp",

  /** API Key settings */
  API_KEY_PREFIX: "a8n_mcp_",
  API_KEY_LENGTH: 48,

  /** Rate limiting (requests per window) */
  RATE_LIMIT: {
    WINDOW_MS: 60_000, // 1 minute
    FREE_TIER: 30,
    PRO_TIER: 120,
  },

  /** Audit logging */
  AUDIT_LOG_ENABLED: process.env.MCP_AUDIT_LOG_ENABLED !== "false",

  /** CORS */
  CORS_ORIGINS: process.env.MCP_CORS_ORIGINS || "*",
} as const;
