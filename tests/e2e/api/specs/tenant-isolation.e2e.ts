import { expect, test } from "@playwright/test";
import {
  CredentialType,
  ExecutionStatus,
} from "../../../../src/generated/prisma";
import { buildE2EUser } from "../fixtures/users";
import { buildMinimalWorkflowGraph } from "../fixtures/workflow-graphs";
import { newSignedUpE2ERequestContext } from "../helpers/auth";
import {
  cleanupE2EData,
  countCredentialById,
  countWorkflowById,
  disconnectE2EDatabase,
  findE2EUserByEmail,
  getApiKeyById,
  getCredentialById,
  getE2EMcpOAuthTokenState,
  getExecutionById,
  getWorkflowById,
  seedE2ECredential,
  seedE2EExecution,
  seedE2EMcpOAuthConnection,
  seedE2EWorkflow,
} from "../helpers/db";
import {
  clearE2EWorkflowDispatches,
  listE2EWorkflowDispatches,
} from "../helpers/dispatches";
import { expectRejects } from "../helpers/assertions";
import { createE2ETrpcClient } from "../helpers/trpc";

test.describe("backend E2E tenant isolation", () => {
  test.beforeEach(async ({ request }) => {
    await cleanupE2EData();
    await clearE2EWorkflowDispatches(request);
  });

  test.afterAll(async () => {
    await cleanupE2EData();
    await disconnectE2EDatabase();
  });

  test("blocks cross-tenant reads, writes, revokes, and dispatches", async ({ request }) => {
    const owner = buildE2EUser("tenant_owner");
    const attacker = buildE2EUser("tenant_attacker");
    const ownerContext = await newSignedUpE2ERequestContext(owner);
    const attackerContext = await newSignedUpE2ERequestContext(attacker);

    try {
      const ownerRecord = await findE2EUserByEmail(owner.email);
      await seedE2EWorkflow({
        id: "e2e_workflow_tenant_isolation_owner",
        userId: ownerRecord.id,
        name: "Tenant Owner Workflow",
      });
      await seedE2ECredential({
        id: "e2e_credential_tenant_isolation_owner",
        userId: ownerRecord.id,
        name: "Tenant Owner Credential",
        type: CredentialType.OPENAI,
        rawValue: "sk-test-e2e-tenant-owner",
      });
      await seedE2EExecution({
        id: "e2e_execution_tenant_isolation_owner",
        workflowId: "e2e_workflow_tenant_isolation_owner",
        status: ExecutionStatus.SUCCESS,
        output: { ok: true },
      });
      await seedE2EMcpOAuthConnection({
        clientId: "e2e_oauth_client_tenant_isolation_owner",
        userId: ownerRecord.id,
        clientName: "Tenant Owner OAuth",
      });

      const ownerTrpc = createE2ETrpcClient(ownerContext);
      const attackerTrpc = createE2ETrpcClient(attackerContext);
      const ownerKey = await ownerTrpc.mcp.createKey.mutate({
        name: "Tenant Owner MCP Key",
        scopes: ["workflows:read"],
      });
      const beforeWorkflow = await getWorkflowById("e2e_workflow_tenant_isolation_owner");
      const graph = buildMinimalWorkflowGraph();

      await expectRejects(
        attackerTrpc.workflows.getOne.query({
          id: "e2e_workflow_tenant_isolation_owner",
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.updateName.mutate({
          id: "e2e_workflow_tenant_isolation_owner",
          name: "Compromised Workflow",
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.update.mutate({
          id: "e2e_workflow_tenant_isolation_owner",
          nodes: graph.nodes,
          edges: graph.edges,
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.remove.mutate({
          id: "e2e_workflow_tenant_isolation_owner",
        }),
      );
      await expectRejects(
        attackerTrpc.workflows.execute.mutate({
          id: "e2e_workflow_tenant_isolation_owner",
        }),
      );

      await expectRejects(
        attackerTrpc.credentials.getOne.query({
          id: "e2e_credential_tenant_isolation_owner",
        }),
      );
      await expectRejects(
        attackerTrpc.credentials.update.mutate({
          id: "e2e_credential_tenant_isolation_owner",
          name: "Compromised Credential",
          type: "OPENAI",
          value: "sk-test-e2e-compromised",
        }),
      );
      await expectRejects(
        attackerTrpc.credentials.remove.mutate({
          id: "e2e_credential_tenant_isolation_owner",
        }),
      );

      await expectRejects(
        attackerTrpc.executions.getOne.query({
          id: "e2e_execution_tenant_isolation_owner",
        }),
      );
      await expect(attackerTrpc.executions.getMany.query({ page: 1, pageSize: 10 }))
        .resolves.toMatchObject({ totalCount: 0, items: [] });

      await expect(
        attackerTrpc.mcp.revokeKey.mutate({ id: ownerKey.record.id }),
      ).resolves.toEqual({ success: false });
      await expect(attackerTrpc.mcp.listOAuthConnections.query()).resolves.toEqual([]);
      await expect(
        attackerTrpc.mcp.revokeOAuthConnection.mutate({
          clientId: "e2e_oauth_client_tenant_isolation_owner",
        }),
      ).resolves.toEqual({
        accessTokensRevoked: 0,
        refreshTokensRevoked: 0,
        consentsRevoked: 0,
      });

      const afterWorkflow = await getWorkflowById("e2e_workflow_tenant_isolation_owner");
      expect(afterWorkflow.name).toBe("Tenant Owner Workflow");
      expect(afterWorkflow.nodes.map((node) => node.id).sort()).toEqual(
        beforeWorkflow.nodes.map((node) => node.id).sort(),
      );
      expect(afterWorkflow.connections).toHaveLength(beforeWorkflow.connections.length);
      await expect(countWorkflowById("e2e_workflow_tenant_isolation_owner"))
        .resolves.toBe(1);
      await expect(getCredentialById("e2e_credential_tenant_isolation_owner"))
        .resolves.toMatchObject({ name: "Tenant Owner Credential" });
      await expect(countCredentialById("e2e_credential_tenant_isolation_owner"))
        .resolves.toBe(1);
      await expect(getExecutionById("e2e_execution_tenant_isolation_owner"))
        .resolves.toMatchObject({ status: ExecutionStatus.SUCCESS });
      await expect(getApiKeyById(ownerKey.record.id))
        .resolves.toMatchObject({ revokedAt: null });
      await expect(
        getE2EMcpOAuthTokenState("e2e_oauth_client_tenant_isolation_owner"),
      ).resolves.toEqual({
        activeAccessTokens: 1,
        activeRefreshTokens: 1,
        activeConsents: 1,
      });
      await expect(
        listE2EWorkflowDispatches(request, "e2e_workflow_tenant_isolation_owner"),
      ).resolves.toEqual([]);
    } finally {
      await ownerContext.dispose();
      await attackerContext.dispose();
    }
  });
});
