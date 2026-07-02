export const TEST_USERS = {
  userA: {
    id: "mcp-test-user-a",
    name: "MCP Test User A",
    email: "user-a@example.test",
  },
  userB: {
    id: "mcp-test-user-b",
    name: "MCP Test User B",
    email: "user-b@example.test",
  },
};

export const READ_ONLY_SCOPES = [
  "workflows:read",
  "credentials:read",
  "executions:read",
  "system:read",
];

export const WRITE_SCOPES = [
  ...READ_ONLY_SCOPES,
  "workflows:write",
  "workflows:execute",
  "credentials:write",
];

export function mcpAuthForUser(user = TEST_USERS.userA, overrides = {}) {
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    scopes: WRITE_SCOPES,
    apiKeyId: `api-key-${user.id}`,
    method: "api_key",
    ...overrides,
  };
}

export function oauthAuthForUser(user = TEST_USERS.userA, overrides = {}) {
  return mcpAuthForUser(user, {
    apiKeyId: undefined,
    method: "oauth",
    oauthTokenId: `oauth-token-${user.id}`,
    oauthClientId: "chatgpt-test-client",
    oauthResource: "http://127.0.0.1:3000/api/mcp",
    ...overrides,
  });
}
