process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.A8N_ENV_PROFILE = process.env.A8N_ENV_PROFILE || "test";
process.env.CI = process.env.CI || "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://a8n_test:a8n_test@127.0.0.1:5432/a8n_test";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-32-characters";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
process.env.APP_URL = process.env.APP_URL || "http://127.0.0.1:3000";
process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL =
  process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || "http://127.0.0.1:3000";
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "test-api-encryption-key-32-characters";
process.env.POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || "test-polar-token";
process.env.POLAR_SUCCESS_URL =
  process.env.POLAR_SUCCESS_URL || "http://127.0.0.1:3000/success";
process.env.MCP_API_KEY_HMAC_SECRET =
  process.env.MCP_API_KEY_HMAC_SECRET || "test-mcp-api-key-hmac-secret-32-chars";
process.env.MCP_OAUTH_TOKEN_HMAC_SECRET =
  process.env.MCP_OAUTH_TOKEN_HMAC_SECRET || "test-mcp-oauth-token-hmac-secret-32";
