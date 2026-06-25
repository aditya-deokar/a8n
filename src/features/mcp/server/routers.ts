import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import z from "zod";
import { createApiKey, listApiKeys, revokeApiKey } from "@/mcp/auth/api-key.service";
import { DEFAULT_SCOPES, type McpScope } from "@/mcp/auth/scopes";

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
});
