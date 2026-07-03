import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import z from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "@/mcp/auth/api-key.service";
import { DEFAULT_SCOPES, type McpScope } from "@/mcp/auth/scopes";
import { revokeOAuthClientUserTokens } from "@/mcp/auth/oauth.service";
import {
  getMcpUserSecuritySummary,
  listMcpOAuthConnectionsForUser,
} from "@/mcp/security/security-summary";

export const mcpRouter = createTRPCRouter({
  createKey: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        scopes: z.array(z.string()).default(DEFAULT_SCOPES),
        expiresInDays: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name, scopes, expiresInDays } = input;
      
      let expiresAt: Date | undefined;
      if (expiresInDays && expiresInDays > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      // Cast scopes safely
      const validScopes = scopes as McpScope[];

      const result = await createApiKey({
        userId: ctx.auth.user.id,
        name,
        scopes: validScopes,
        expiresAt,
      });

      return result;
    }),

  listKeys: protectedProcedure.query(async ({ ctx }) => {
    return listApiKeys(ctx.auth.user.id);
  }),

  revokeKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await revokeApiKey({
        keyId: input.id,
        userId: ctx.auth.user.id,
      });
      return { success };
    }),

  securitySummary: protectedProcedure.query(async ({ ctx }) => {
    return getMcpUserSecuritySummary(ctx.auth.user.id);
  }),

  listOAuthConnections: protectedProcedure.query(async ({ ctx }) => {
    return listMcpOAuthConnectionsForUser(ctx.auth.user.id);
  }),

  revokeOAuthConnection: protectedProcedure
    .input(z.object({ clientId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return revokeOAuthClientUserTokens({
        userId: ctx.auth.user.id,
        clientId: input.clientId,
      });
    }),
});
