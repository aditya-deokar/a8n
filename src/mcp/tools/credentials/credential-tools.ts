/**
 * Credential Tools — All 6 credential MCP tools
 * 
 * Tools: list_credentials, get_credential, create_credential,
 *        update_credential, delete_credential, list_credentials_by_type
 *
 * SECURITY: Credential secret values are NEVER returned in responses.
 * Only metadata (id, name, type, timestamps) is exposed.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { CredentialType } from "@/generated/prisma";
import { encrypt } from "@/lib/encryption";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse, mcpTextResponse } from "@/mcp/shared/sanitize";
import {
  normalizePagination,
  buildPaginationOutput,
} from "@/mcp/shared/pagination";
import type { McpAuthInfo } from "@/mcp/auth/types";

/** Select only safe fields — never include `value` (encrypted secret) */
const SAFE_CREDENTIAL_SELECT = {
  id: true,
  name: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── list_credentials ────────────────────────────────────────

export function registerListCredentials(server: McpServer) {
  server.tool(
    "list_credentials",
    "List all credentials for the authenticated user with pagination and search. Secret values are never returned — only metadata.",
    {
      page: z.number().min(1).default(1).describe("Page number"),
      pageSize: z.number().min(1).max(100).default(10).describe("Results per page"),
      search: z.string().default("").describe("Filter by name (case-insensitive)"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:read");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "list_credentials", input: args as Record<string, unknown>,
      });

      return withErrorBoundary("list_credentials", async () => {
        const { page, pageSize, skip, take } = normalizePagination(args);
        const where = {
          userId: auth.userId,
          name: { contains: args.search || "", mode: "insensitive" as const },
        };

        const [items, totalCount] = await Promise.all([
          prisma.credential.findMany({
            skip, take, where,
            select: SAFE_CREDENTIAL_SELECT,
            orderBy: { updatedAt: "desc" },
          }),
          prisma.credential.count({ where }),
        ]);

        audit.success();
        return mcpJsonResponse({
          credentials: items,
          ...buildPaginationOutput(page, pageSize, totalCount),
        });
      });
    },
  );
}

// ─── get_credential ──────────────────────────────────────────

export function registerGetCredential(server: McpServer) {
  server.tool(
    "get_credential",
    "Get a single credential's metadata by ID. The secret value is never returned.",
    {
      id: z.string().describe("The credential ID"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:read");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "get_credential", input: args,
      });

      return withErrorBoundary("get_credential", async () => {
        const credential = await prisma.credential.findUniqueOrThrow({
          where: { id: args.id, userId: auth.userId },
          select: SAFE_CREDENTIAL_SELECT,
        });

        audit.success();
        return mcpJsonResponse(credential);
      });
    },
  );
}

// ─── create_credential ───────────────────────────────────────

export function registerCreateCredential(server: McpServer) {
  server.tool(
    "create_credential",
    "Create a new credential. The value is encrypted at rest. Available types: OPENAI, ANTHROPIC, GEMINI, SMTP_EMAIL, GOOGLE_SHEETS.",
    {
      name: z.string().min(1).describe("Human-readable name for this credential"),
      type: z.enum(CredentialType).describe("Credential type"),
      value: z.string().min(1).describe("The secret value (e.g., API key). Will be encrypted."),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "create_credential",
        input: { name: args.name, type: args.type },
      });

      return withErrorBoundary("create_credential", async () => {
        const credential = await prisma.credential.create({
          data: {
            name: args.name,
            type: args.type as CredentialType,
            value: encrypt(args.value),
            userId: auth.userId,
          },
          select: SAFE_CREDENTIAL_SELECT,
        });

        audit.success();
        return mcpJsonResponse({
          message: `Credential "${credential.name}" created successfully.`,
          credential,
        });
      });
    },
  );
}

// ─── update_credential ───────────────────────────────────────

export function registerUpdateCredential(server: McpServer) {
  server.tool(
    "update_credential",
    "Update an existing credential's name, type, and/or value.",
    {
      id: z.string().describe("The credential ID to update"),
      name: z.string().min(1).describe("New name"),
      type: z.enum(CredentialType).describe("New credential type"),
      value: z.string().min(1).describe("New secret value (will be encrypted)"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "update_credential",
        input: { id: args.id, name: args.name, type: args.type },
      });

      return withErrorBoundary("update_credential", async () => {
        const credential = await prisma.credential.update({
          where: { id: args.id, userId: auth.userId },
          data: {
            name: args.name,
            type: args.type as CredentialType,
            value: encrypt(args.value),
          },
          select: SAFE_CREDENTIAL_SELECT,
        });

        audit.success();
        return mcpJsonResponse({
          message: `Credential "${credential.name}" updated.`,
          credential,
        });
      });
    },
  );
}

// ─── delete_credential ───────────────────────────────────────

export function registerDeleteCredential(server: McpServer) {
  server.tool(
    "delete_credential",
    "Permanently delete a credential. Any nodes using it will lose their credential reference.",
    {
      id: z.string().describe("The credential ID to delete"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:write");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "delete_credential", input: args,
      });

      return withErrorBoundary("delete_credential", async () => {
        await prisma.credential.delete({
          where: { id: args.id, userId: auth.userId },
        });

        audit.success();
        return mcpTextResponse(`Credential ${args.id} deleted.`);
      });
    },
  );
}

// ─── list_credentials_by_type ────────────────────────────────

export function registerListCredentialsByType(server: McpServer) {
  server.tool(
    "list_credentials_by_type",
    "List all credentials of a specific type. Useful for finding credentials to attach to workflow nodes.",
    {
      type: z.enum(CredentialType).describe("Credential type to filter by"),
    },
    async (args, extra) => {
      const auth = (extra as any).authInfo as McpAuthInfo;
      requireScope(auth, "credentials:read");

      const audit = createAuditContext({
        userId: auth.userId, apiKeyId: auth.apiKeyId,
        authMethod: auth.method, tool: "list_credentials_by_type", input: args,
      });

      return withErrorBoundary("list_credentials_by_type", async () => {
        const credentials = await prisma.credential.findMany({
          where: {
            type: args.type as CredentialType,
            userId: auth.userId,
          },
          select: SAFE_CREDENTIAL_SELECT,
          orderBy: { updatedAt: "desc" },
        });

        audit.success();
        return mcpJsonResponse({ credentials, count: credentials.length });
      });
    },
  );
}
