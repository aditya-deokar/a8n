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
    process.env.MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION === "true" ||
    (process.env.MCP_OAUTH_ALLOW_DYNAMIC_CLIENT_REGISTRATION === undefined &&
      process.env.NODE_ENV !== "production"),
  OAUTH_ROTATE_REFRESH_TOKENS:
    process.env.MCP_OAUTH_ROTATE_REFRESH_TOKENS !== "false",
  OAUTH_EXACT_REDIRECT_URIS:
    process.env.MCP_OAUTH_EXACT_REDIRECT_URIS === "true" ||
    process.env.NODE_ENV === "production",

  /** Rate limiting (requests per window) */
  RATE_LIMIT: {
    WINDOW_MS: 60_000, // 1 minute
    FREE_TIER: 30,
    PRO_TIER: 120,
    BACKEND:
      process.env.MCP_RATE_LIMIT_BACKEND ||
      (process.env.NODE_ENV === "production" ? "database" : "memory"),
  },

  /** Audit logging */
  AUDIT_LOG_ENABLED: process.env.MCP_AUDIT_LOG_ENABLED !== "false",
  AUDIT_DB_ENABLED: process.env.MCP_AUDIT_DB_ENABLED !== "false",

  /** Observability and runtime guardrails */
  OBSERVABILITY_LOG_ENABLED: process.env.MCP_OBSERVABILITY_LOG_ENABLED !== "false",
  ALERT_WINDOW_MS: Number(process.env.MCP_ALERT_WINDOW_MS || 300_000),
  ALERT_AUTH_FAILURE_THRESHOLD: Number(process.env.MCP_ALERT_AUTH_FAILURE_THRESHOLD || 20),
  ALERT_SCOPE_DENIAL_THRESHOLD: Number(process.env.MCP_ALERT_SCOPE_DENIAL_THRESHOLD || 20),
  ALERT_PROMPT_INJECTION_THRESHOLD: Number(process.env.MCP_ALERT_PROMPT_INJECTION_THRESHOLD || 5),
  ALERT_APPROVAL_BYPASS_THRESHOLD: Number(process.env.MCP_ALERT_APPROVAL_BYPASS_THRESHOLD || 3),
  ALERT_TOOL_ERROR_RATE_PERCENT: Number(process.env.MCP_ALERT_TOOL_ERROR_RATE_PERCENT || 10),
  ALERT_RATE_LIMIT_DENIAL_THRESHOLD: Number(process.env.MCP_ALERT_RATE_LIMIT_DENIAL_THRESHOLD || 25),
  ALERT_OAUTH_TOKEN_ERROR_THRESHOLD: Number(process.env.MCP_ALERT_OAUTH_TOKEN_ERROR_THRESHOLD || 10),
  ALERT_AUDIT_PERSIST_FAILURE_THRESHOLD: Number(process.env.MCP_ALERT_AUDIT_PERSIST_FAILURE_THRESHOLD || 1),
  DISABLE_SIDE_EFFECT_TOOLS: process.env.MCP_DISABLE_SIDE_EFFECT_TOOLS === "true",
  DISABLE_CREDENTIAL_MUTATION: process.env.MCP_DISABLE_CREDENTIAL_MUTATION === "true",
  FORCE_READ_ONLY_CHATGPT_PROFILE: process.env.MCP_FORCE_READ_ONLY_CHATGPT_PROFILE === "true",
  SAFETY_STRICT_MODE: process.env.MCP_SAFETY_STRICT_MODE === "true",

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
