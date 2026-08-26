import { generateSlug } from "random-word-slugs";
import { createId } from "@paralleldrive/cuid2";
import prisma from "@/lib/db";
import type { Node, Edge } from "@xyflow/react";
import {
  createTRPCRouter,
  protectedProcedure,
  workflowQuotaProcedure,
} from "@/trpc/init";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { PAGINATION } from "@/config/constants";
import { NodeType, Prisma } from "@/generated/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { quotaTrpcError } from "@/lib/entitlements/trpc-bridge";
import { encrypt } from "@/lib/encryption";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import type {
  NodeExecutorParams,
  StepTools,
} from "@/features/executions/types";
import { validateWorkflowGraph } from "./graph-validation";

const VERSION_HISTORY_LIMIT = 20;

// React Flow edges carry generated ids; only these fields are persisted.
const edgeInputSchema = z.object({
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
});

const nodeInputSchema = z.object({
  id: z.string(),
  type: z
    .string()
    .refine(
      (value) => Object.values(NodeType).includes(value as NodeType),
      "Invalid node type",
    ),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.any()).optional(),
});

export const workflowsRouter = createTRPCRouter({
  execute: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      });

      // Quota is consumed exactly once â€” inside sendWorkflowExecution.
      try {
        await sendWorkflowExecution({
          workflowId: input.id,
          userId: ctx.auth.user.id,
        });
      } catch (error) {
        const mapped = quotaTrpcError(error);
        if (mapped) throw mapped;
        throw error;
      }

      return workflow;
    }),
  create: workflowQuotaProcedure.mutation(({ ctx }) => {
    return ctx.withQuotaSlot((tx) =>
      tx.workflow.create({
        data: {
          name: generateSlug(3),
          userId: ctx.auth.user.id,
          nodes: {
            create: {
              type: NodeType.INITIAL,
              position: { x: 0, y: 0 },
              name: NodeType.INITIAL,
            },
          },
        },
      }),
    );
  }),
  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      })
    }),
  update: protectedProcedure
    .input(
      z.object({ 
        id: z.string(), 
        nodes: z.array(nodeInputSchema),
        edges: z.array(edgeInputSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, nodes, edges } = input;

      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id, userId: ctx.auth.user.id },
      });

      validateWorkflowGraph(nodes, edges);

      try {
        return await prisma.$transaction(async (tx) => {
          // Delete existing nodes and connections (cascade deletes connections)
          await tx.node.deleteMany({
            where: { workflowId: id },
          });

          // Create nodes
          await tx.node.createMany({
            data: nodes.map((node) => ({
              id: node.id,
              workflowId: id,
              name: node.type,
              type: node.type as NodeType,
              position: node.position,
              data: node.data || {},
              // Persist the relational credential link when provided so the
              // graph model matches what MCP tooling writes.
              credentialId:
                typeof node.data?.credentialId === "string"
                  ? node.data.credentialId
                  : null,
            })),
          });

          // Create connections
          await tx.connection.createMany({
            data: edges.map((edge) => ({
              workflowId: id,
              fromNodeId: edge.source,
              toNodeId: edge.target,
              fromOutput: edge.sourceHandle || "main",
              toInput: edge.targetHandle || "main",
            })),
          });

          // Snapshot every manual save into version history.
          await tx.workflowVersion.create({
            data: {
              workflowId: id,
              userId: ctx.auth.user.id,
              name: workflow.name,
              nodes: nodes as unknown as Prisma.InputJsonValue[],
              edges: edges as unknown as Prisma.InputJsonValue[],
              summary: "Manual save",
              createdByTool: "editor",
            },
          });

          // Prune old versions beyond the retention limit.
          const staleVersions = await tx.workflowVersion.findMany({
            where: { workflowId: id },
            orderBy: { createdAt: "desc" },
            skip: VERSION_HISTORY_LIMIT,
            select: { id: true },
          });
          if (staleVersions.length > 0) {
            await tx.workflowVersion.deleteMany({
              where: { id: { in: staleVersions.map((v) => v.id) } },
            });
          }

          // Update workflow's updatedAt timestamp
          const updated = await tx.workflow.update({
            where: { id },
            data: { updatedAt: new Date() },
          });

          return updated;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Duplicate connection between the same nodes is not allowed.",
            });
          }
          if (error.code === "P2003") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "A connection references a node that no longer exists. Refresh the editor and try again.",
            });
          }
        }
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save workflow.",
          cause: error,
        });
      }
    }),
  setActive: protectedProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.update({
        where: { id: input.id, userId: ctx.auth.user.id },
        data: { active: input.active },
      });
    }),
  /**
   * Stores an encrypted webhook secret on a trigger node. The plaintext
   * secret never round-trips through the client — the encrypted value is
   * returned so the canvas can persist it across saves.
   */
  setWebhookSecret: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodeId: z.string(),
        secret: z.string().max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.workflow.findUniqueOrThrow({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        select: { id: true },
      });

      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflowId: input.workflowId,
          type: { in: [NodeType.STRIPE_TRIGGER, NodeType.GOOGLE_FORM_TRIGGER] },
        },
        select: { id: true, data: true },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trigger node not found.",
        });
      }

      const encrypted = encrypt(input.secret);
      const data = {
        ...((node.data as Record<string, unknown>) || {}),
        webhookSecret: encrypted,
      };

      await prisma.node.update({
        where: { id: node.id },
        data: { data: data as Prisma.InputJsonValue },
      });

      return { ok: true, nodeId: node.id, webhookSecret: encrypted };
    }),
  /**
   * Executes a single action node in isolation with an empty context so users
   * can verify configuration (credentials, templates, endpoints) without
   * running the whole workflow.
   */
  testNode: protectedProcedure
    .input(
      z.object({
        type: z.enum(NodeType),
        data: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nonTestableTypes = new Set<NodeType>([
        NodeType.INITIAL,
        NodeType.MANUAL_TRIGGER,
        NodeType.GOOGLE_FORM_TRIGGER,
        NodeType.STRIPE_TRIGGER,
      ]);
      if (nonTestableTypes.has(input.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This node type cannot be tested directly.",
        });
      }

      const executor = getExecutor(input.type);

      // Mock step tools that run everything immediately — the test happens
      // synchronously inside the tRPC request instead of a durable run.
      const mockStep = {
        run: async (_id: string, fn: () => unknown) => fn(),
        ai: {
          wrap: async (
            _id: string,
            fn: (args: unknown) => unknown,
            args: unknown,
          ) => fn(args),
        },
      } as unknown as StepTools;

      const noopPublish = (async () => undefined) as unknown as NodeExecutorParams["publish"];

      try {
        const output = await executor({
          data: input.data,
          nodeId: "test-run",
          userId: ctx.auth.user.id,
          context: {},
          step: mockStep,
          publish: noopPublish,
        });
        return { ok: true as const, output };
      } catch (error) {
        return {
          ok: false as const,
          error:
            error instanceof Error
              ? error.message
              : "Node execution failed with an unknown error.",
        };
      }
    }),
  updateName: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      return prisma.workflow.update({
        where: { id: input.id, userId: ctx.auth.user.id },
        data: { name: input.name },
      });
    }),
  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
        include: { nodes: true, connections: true },
      });

      // Transform server nodes to react-flow compatible nodes
      const nodes: Node[] = workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position as { x: number, y: number },
        data: (node.data as Record<string, unknown>) || {},
      }));

      // Transform server connections to react-flow compatible edges
      const edges: Edge[] = workflow.connections.map((connection) => ({
        id: connection.id,
        source: connection.fromNodeId,
        target: connection.toNodeId,
        sourceHandle: connection.fromOutput,
        targetHandle: connection.toInput,
        updatable: true,
      }));

      return {
        id: workflow.id,
        name: workflow.name,
        nodes,
        edges,
      };
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const [items, totalCount] = await Promise.all([
        prisma.workflow.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: { 
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        }),
        prisma.workflow.count({
          where: {
            userId: ctx.auth.user.id,
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };
    }),
  getVersions: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [items, totalCount] = await Promise.all([
        prisma.workflowVersion.findMany({
          where: {
            workflowId: input.workflowId,
            userId: ctx.auth.user.id,
          },
          orderBy: { createdAt: "desc" },
          take: VERSION_HISTORY_LIMIT,
          select: {
            id: true,
            name: true,
            summary: true,
            createdByTool: true,
            createdAt: true,
            nodes: true,
            edges: true,
          },
        }),
        prisma.workflowVersion.count({
          where: {
            workflowId: input.workflowId,
            userId: ctx.auth.user.id,
          },
        }),
      ]);

      return {
        items: items.map((version) => ({
          id: version.id,
          name: version.name,
          summary: version.summary,
          createdByTool: version.createdByTool,
          createdAt: version.createdAt,
          nodeCount: Array.isArray(version.nodes) ? version.nodes.length : 0,
          edgeCount: Array.isArray(version.edges) ? version.edges.length : 0,
        })),
        totalCount,
      };
    }),
  restoreVersion: protectedProcedure
    .input(z.object({ workflowId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await prisma.workflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: input.workflowId,
          userId: ctx.auth.user.id,
        },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found.",
        });
      }

      const parsedNodes = z.array(nodeInputSchema).safeParse(version.nodes);
      const parsedEdges = z.array(edgeInputSchema).safeParse(version.edges);

      if (!parsedNodes.success || !parsedEdges.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This version's data is corrupted and cannot be restored.",
        });
      }

      validateWorkflowGraph(parsedNodes.data, parsedEdges.data);

      try {
        return await prisma.$transaction(async (tx) => {
          // Preserve the current state so the restore itself is reversible.
          const currentNodes = await tx.node.findMany({
            where: { workflowId: input.workflowId },
          });
          const currentConnections = await tx.connection.findMany({
            where: { workflowId: input.workflowId },
          });

          await tx.workflowVersion.create({
            data: {
              workflowId: input.workflowId,
              userId: ctx.auth.user.id,
              name: version.name,
              nodes: currentNodes.map((node) => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: node.data,
              })) as unknown as Prisma.InputJsonValue[],
              edges: currentConnections.map((connection) => ({
                source: connection.fromNodeId,
                target: connection.toNodeId,
                sourceHandle: connection.fromOutput,
                targetHandle: connection.toInput,
              })) as unknown as Prisma.InputJsonValue[],
              summary: "Auto-save before restore",
              createdByTool: "editor",
            },
          });

          await tx.node.deleteMany({
            where: { workflowId: input.workflowId },
          });

          await tx.node.createMany({
            data: parsedNodes.data.map((node) => ({
              id: node.id,
              workflowId: input.workflowId,
              name: node.type,
              type: node.type as NodeType,
              position: node.position,
              data: node.data || {},
              credentialId:
                typeof node.data?.credentialId === "string"
                  ? node.data.credentialId
                  : null,
            })),
          });

          await tx.connection.createMany({
            data: parsedEdges.data.map((edge) => ({
              workflowId: input.workflowId,
              fromNodeId: edge.source,
              toNodeId: edge.target,
              fromOutput: edge.sourceHandle || "main",
              toInput: edge.targetHandle || "main",
            })),
          });

          return tx.workflow.update({
            where: { id: input.workflowId },
            data: { updatedAt: new Date() },
          });
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restore version.",
          cause: error,
        });
      }
    }),
  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.workflow.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
        include: { nodes: true, connections: true },
      });

      return prisma.$transaction(async (tx) => {
        const copy = await tx.workflow.create({
          data: {
            name: `${source.name} (Copy)`.slice(0, 120),
            userId: ctx.auth.user.id,
            active: false,
          },
        });

        // Fresh node ids are required; remap connections accordingly.
        const idMap = new Map<string, string>();
        for (const node of source.nodes) {
          idMap.set(node.id, createId());
        }

          await tx.node.createMany({
            data: source.nodes.map((node) => ({
              id: idMap.get(node.id)!,
              workflowId: copy.id,
              name: node.name,
              type: node.type,
              position: node.position as Prisma.InputJsonValue,
              data: (node.data ?? {}) as Prisma.InputJsonValue,
              credentialId: node.credentialId,
            })),
          });

        if (source.connections.length > 0) {
          await tx.connection.createMany({
            data: source.connections.map((connection) => ({
              workflowId: copy.id,
              fromNodeId: idMap.get(connection.fromNodeId)!,
              toNodeId: idMap.get(connection.toNodeId)!,
              fromOutput: connection.fromOutput,
              toInput: connection.toInput,
            })),
          });
        }

        return copy;
      });
    }),
});
