import { createId } from "@paralleldrive/cuid2";
import { AgentThreadStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { createAgentThread } from "@/agent/service";
import { approvalService } from "@/agent/safety/approval-service";
import { agentMemoryStore } from "@/agent/memory/store";
import { MEMORY_CATEGORIES, buildMemoryNamespace, type MemoryCategory } from "@/agent/memory/namespaces";
import { z } from "zod";

export const agentRouter = createTRPCRouter({
  listThreads: protectedProcedure
    .input(z.object({ workflowId: z.string().optional() }).default({}))
    .query(({ ctx, input }) =>
      prisma.agentThread.findMany({
        where: {
          userId: ctx.auth.user.id,
          workflowId: input.workflowId,
          status: AgentThreadStatus.ACTIVE,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          langgraphThreadId: true,
          workflowId: true,
          title: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),

  createThread: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().optional(),
        title: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      createAgentThread({
        userId: ctx.auth.user.id,
        workflowId: input.workflowId,
        title: input.title,
      }),
    ),

  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(({ ctx, input }) =>
      prisma.agentThread.findFirstOrThrow({
        where: { id: input.threadId, userId: ctx.auth.user.id },
        select: {
          id: true,
          langgraphThreadId: true,
          workflowId: true,
          title: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),

  archiveThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(({ ctx, input }) =>
      prisma.agentThread.updateMany({
        where: { id: input.threadId, userId: ctx.auth.user.id },
        data: { status: AgentThreadStatus.ARCHIVED },
      }),
    ),

  ensureThread: protectedProcedure
    .input(z.object({ workflowId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.agentThread.findFirst({
        where: {
          userId: ctx.auth.user.id,
          workflowId: input.workflowId,
          status: AgentThreadStatus.ACTIVE,
        },
        orderBy: { updatedAt: "desc" },
      });
      return existing || createAgentThread({ userId: ctx.auth.user.id, workflowId: input.workflowId, title: createId() });
    }),

  // --- Approval procedures ---

  listPendingApprovals: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(({ ctx, input }) =>
      approvalService.listPending({
        threadId: input.threadId,
        userId: ctx.auth.user.id,
      }),
    ),

  approveApproval: protectedProcedure
    .input(z.object({ approvalId: z.string() }))
    .mutation(({ ctx, input }) =>
      approvalService.resolveApproval({
        approvalId: input.approvalId,
        userId: ctx.auth.user.id,
        action: "approve",
      }),
    ),

  rejectApproval: protectedProcedure
    .input(
      z.object({
        approvalId: z.string(),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      approvalService.resolveApproval({
        approvalId: input.approvalId,
        userId: ctx.auth.user.id,
        action: "reject",
        reason: input.reason,
      }),
    ),

  // --- Memory management procedures ---

  listMemories: protectedProcedure
    .input(
      z.object({
        category: z.enum(["workflow-preferences", "workflow-patterns", "conversation-summaries"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;
      const categories: MemoryCategory[] = input.category
        ? [input.category]
        : [...MEMORY_CATEGORIES];

      const results = await Promise.all(
        categories.map(async (category) => {
          const namespace = buildMemoryNamespace(userId, category);
          // Use a broad query to list all memories in the namespace
          const items = await agentMemoryStore.search({
            userId,
            namespace,
            query: "workflow automation preferences patterns",
            limit: input.limit,
          });
          return items.map((item) => ({
            id: item.id,
            content: item.content,
            category,
            score: item.score,
            expiresAt: item.expiresAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }));
        }),
      );

      return results.flat().sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }),

  deleteMemory: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await agentMemoryStore.delete({
        userId: ctx.auth.user.id,
        id: input.memoryId,
      });
      return { deleted: true };
    }),

  deleteAllMemories: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.auth.user.id;
      // Soft-delete all memories for this user across all namespaces
      const deleted = await prisma.$executeRaw`
        UPDATE "agent_memory_item"
        SET "deletedAt" = NOW(), "consentStatus" = 'deleted', "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      `;
      return { deleted: Number(deleted) };
    }),
});

