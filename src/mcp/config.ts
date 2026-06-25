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

  /** OAuth account linking */
  OAUTH_ACCESS_TOKEN_PREFIX: "a8n_oauth_at_",
  OAUTH_REFRESH_TOKEN_PREFIX: "a8n_oauth_rt_",
  OAUTH_AUTH_CODE_PREFIX: "a8n_oauth_code_",
  OAUTH_ACCESS_TOKEN_TTL_SECONDS: Number(process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS || 3600),
  OAUTH_REFRESH_TOKEN_TTL_SECONDS: Number(process.env.MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS || 2_592_000),
  OAUTH_AUTH_CODE_TTL_SECONDS: Number(process.env.MCP_OAUTH_AUTH_CODE_TTL_SECONDS || 600),
  OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION:
    process.env.MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION !== "false",

  /** Rate limiting (requests per window) */
  RATE_LIMIT: {
    WINDOW_MS: 60_000, // 1 minute
    FREE_TIER: 30,
    PRO_TIER: 120,
  },

  /** Audit logging */
  AUDIT_LOG_ENABLED: process.env.MCP_AUDIT_LOG_ENABLED !== "false",
  AUDIT_DB_ENABLED: process.env.MCP_AUDIT_DB_ENABLED !== "false",

  /** CORS */
  CORS_ORIGINS: process.env.MCP_CORS_ORIGINS || "*",

  /** Webhook hardening */
  WEBHOOK_SHARED_SECRET_CONFIGURED: Boolean(process.env.A8N_WEBHOOK_SHARED_SECRET),
  GOOGLE_FORM_WEBHOOK_SECRET_CONFIGURED: Boolean(process.env.GOOGLE_FORM_WEBHOOK_SECRET),
  STRIPE_WEBHOOK_SECRET_CONFIGURED: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  STRIPE_WEBHOOK_SHARED_SECRET_CONFIGURED: Boolean(process.env.STRIPE_WEBHOOK_SHARED_SECRET),

  /** API key hashing */
  API_KEY_HMAC_ENABLED: Boolean(process.env.MCP_API_KEY_HMAC_SECRET),
} as const;
