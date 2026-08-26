export const apiProcedureCases = [
  {
    path: "workflows.create",
    access: "premium",
    call: (caller) => caller.workflows.create(),
  },
  {
    path: "workflows.remove",
    access: "protected",
    call: (caller) => caller.workflows.remove({ id: "workflow_a" }),
  },
  {
    path: "workflows.update",
    access: "protected",
    call: (caller) =>
      caller.workflows.update({
        id: "workflow_a",
        nodes: [
          {
            id: "node_a",
            type: "INITIAL",
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
      }),
  },
  {
    path: "workflows.updateName",
    access: "protected",
    call: (caller) => caller.workflows.updateName({ id: "workflow_a", name: "Renamed" }),
  },
  {
    path: "workflows.getOne",
    access: "protected",
    call: (caller) => caller.workflows.getOne({ id: "workflow_a" }),
  },
  {
    path: "workflows.getMany",
    access: "protected",
    call: (caller) => caller.workflows.getMany({ page: 1, pageSize: 5, search: "" }),
  },
  {
    path: "workflows.execute",
    access: "protected",
    call: (caller) => caller.workflows.execute({ id: "workflow_a" }),
  },
  {
    path: "workflows.setActive",
    access: "protected",
    call: (caller) => caller.workflows.setActive({ id: "workflow_a", active: true }),
  },
  {
    path: "workflows.setWebhookSecret",
    access: "protected",
    call: (caller) =>
      caller.workflows.setWebhookSecret({
        workflowId: "workflow_a",
        nodeId: "node_a",
        secret: "whsec_test",
      }),
  },
  {
    path: "workflows.testNode",
    access: "protected",
    call: (caller) =>
      caller.workflows.testNode({ type: "HTTP_REQUEST", data: {} }),
  },
  {
    path: "workflows.getVersions",
    access: "protected",
    call: (caller) => caller.workflows.getVersions({ workflowId: "workflow_a" }),
  },
  {
    path: "workflows.restoreVersion",
    access: "protected",
    call: (caller) =>
      caller.workflows.restoreVersion({
        workflowId: "workflow_a",
        versionId: "version_a",
      }),
  },
  {
    path: "workflows.duplicate",
    access: "protected",
    call: (caller) => caller.workflows.duplicate({ id: "workflow_a" }),
  },
  {
    path: "credentials.create",
    access: "premium",
    call: (caller) =>
      caller.credentials.create({
        name: "OpenAI",
        type: "OPENAI",
        value: "sk-test",
      }),
  },
  {
    path: "credentials.remove",
    access: "protected",
    call: (caller) => caller.credentials.remove({ id: "credential_a" }),
  },
  {
    path: "credentials.update",
    access: "protected",
    call: (caller) =>
      caller.credentials.update({
        id: "credential_a",
        name: "OpenAI",
        type: "OPENAI",
        value: "sk-new",
      }),
  },
  {
    path: "credentials.getOne",
    access: "protected",
    call: (caller) => caller.credentials.getOne({ id: "credential_a" }),
  },
  {
    path: "credentials.getMany",
    access: "protected",
    call: (caller) => caller.credentials.getMany({ page: 1, pageSize: 5, search: "" }),
  },
  {
    path: "credentials.getByType",
    access: "protected",
    call: (caller) => caller.credentials.getByType({ type: "OPENAI" }),
  },
  {
    path: "executions.getOne",
    access: "protected",
    call: (caller) => caller.executions.getOne({ id: "execution_a" }),
  },
  {
    path: "executions.getMany",
    access: "protected",
    call: (caller) => caller.executions.getMany({ page: 1, pageSize: 5 }),
  },
  {
    path: "mcp.createKey",
    access: "protected",
    call: (caller) =>
      caller.mcp.createKey({
        name: "Dashboard key",
        scopes: ["workflows:read", "system:read"],
        expiresInDays: 30,
      }),
  },
  {
    path: "mcp.listKeys",
    access: "protected",
    call: (caller) => caller.mcp.listKeys(),
  },
  {
    path: "mcp.revokeKey",
    access: "protected",
    call: (caller) => caller.mcp.revokeKey({ id: "api_key_a" }),
  },
  {
    path: "mcp.securitySummary",
    access: "protected",
    call: (caller) => caller.mcp.securitySummary(),
  },
  {
    path: "mcp.listOAuthConnections",
    access: "protected",
    call: (caller) => caller.mcp.listOAuthConnections(),
  },
  {
    path: "mcp.revokeOAuthConnection",
    access: "protected",
    call: (caller) => caller.mcp.revokeOAuthConnection({ clientId: "client_a" }),
  },
  {
    path: "agent.createThread",
    access: "protected",
    call: (caller) => caller.agent.createThread({ title: "New thread" }),
  },
  {
    path: "agent.getThread",
    access: "protected",
    call: (caller) => caller.agent.getThread({ threadId: "thread_a" }),
  },
  {
    path: "agent.listThreads",
    access: "protected",
    call: (caller) => caller.agent.listThreads({ limit: 10 }),
  },
  {
    path: "agent.archiveThread",
    access: "protected",
    call: (caller) => caller.agent.archiveThread({ threadId: "thread_a" }),
  },
  {
    path: "agent.ensureThread",
    access: "protected",
    call: (caller) => caller.agent.ensureThread({ threadId: "thread_a" }),
  },
  {
    path: "agent.listMemories",
    access: "protected",
    call: (caller) => caller.agent.listMemories({ limit: 10 }),
  },
  {
    path: "agent.deleteMemory",
    access: "protected",
    call: (caller) => caller.agent.deleteMemory({ memoryId: "mem_a" }),
  },
  {
    path: "agent.deleteAllMemories",
    access: "protected",
    call: (caller) => caller.agent.deleteAllMemories(),
  },
  {
    path: "agent.listPendingApprovals",
    access: "protected",
    call: (caller) => caller.agent.listPendingApprovals(),
  },
  {
    path: "agent.approveApproval",
    access: "protected",
    call: (caller) => caller.agent.approveApproval({ approvalId: "appr_a" }),
  },
  {
    path: "agent.rejectApproval",
    access: "protected",
    call: (caller) => caller.agent.rejectApproval({ approvalId: "appr_a" }),
  },
  {
    path: "subscriptions.getSnapshot",
    access: "protected",
    call: (caller) => caller.subscriptions.getSnapshot(),
  },
  {
    path: "subscriptions.syncNow",
    access: "protected",
    call: (caller) => caller.subscriptions.syncNow(),
  },
];

export const expectedApiProcedurePaths = apiProcedureCases.map((item) => item.path).sort();
