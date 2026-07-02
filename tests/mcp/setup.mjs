process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.MCP_AUDIT_DB_ENABLED = process.env.MCP_AUDIT_DB_ENABLED || "false";
process.env.MCP_AUDIT_LOG_ENABLED = process.env.MCP_AUDIT_LOG_ENABLED || "false";
process.env.MCP_API_KEY_HMAC_SECRET =
  process.env.MCP_API_KEY_HMAC_SECRET || "test-mcp-api-key-hmac-secret-32";
process.env.MCP_OAUTH_TOKEN_HMAC_SECRET =
  process.env.MCP_OAUTH_TOKEN_HMAC_SECRET || "test-mcp-oauth-token-hmac-secret-32";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
process.env.APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test";
