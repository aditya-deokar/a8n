export const fixtureDate = new Date("2026-07-03T00:00:00.000Z");

export function buildWorkflow(overrides = {}) {
  return {
    id: "workflow_a",
    name: "Primary workflow",
    userId: "user_a_pro",
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
    nodes: [
      {
        id: "node_initial",
        workflowId: "workflow_a",
        name: "INITIAL",
        type: "INITIAL",
        position: { x: 0, y: 0 },
        data: {},
        credentialId: null,
        createdAt: fixtureDate,
        updatedAt: fixtureDate,
      },
    ],
    connections: [],
    executions: [],
    drafts: [],
    versions: [],
    ...overrides,
  };
}

export function buildCredential(overrides = {}) {
  return {
    id: "credential_a",
    name: "OpenAI Test Credential",
    type: "OPENAI",
    value: "encrypted:test-secret",
    userId: "user_a_pro",
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
    ...overrides,
  };
}

export function buildExecution(overrides = {}) {
  return {
    id: "execution_a",
    workflowId: "workflow_a",
    status: "SUCCESS",
    error: null,
    errorStack: null,
    startedAt: fixtureDate,
    completedAt: fixtureDate,
    inngestEventId: "event_a",
    output: { ok: true },
    workflow: {
      id: "workflow_a",
      name: "Primary workflow",
    },
    ...overrides,
  };
}

export function buildApiKey(overrides = {}) {
  return {
    id: "api_key_a",
    name: "Dashboard key",
    keyPrefix: "a8n_mcp_abcd1234",
    scopes: ["workflows:read", "system:read"],
    userId: "user_a_pro",
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: fixtureDate,
    ...overrides,
  };
}
