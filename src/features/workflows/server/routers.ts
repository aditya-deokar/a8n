import prisma from "@/lib/db";
import { generateSlug } from "random-word-slugs"
import { createTRPCRouter, premiumProcedure, protectedProcedure } from "@/trpc/init";
import z from "zod";
import { PAGINATION } from "@/config/constants";
import { NodeType } from "@/generated/prisma/enums";
import { Edge, Node } from "@xyflow/react";


export const workflowsRouter = createTRPCRouter({
    create : premiumProcedure.mutation(({ctx})=>{
        return prisma.workflow.create({
            data:{
                name:generateSlug(3),
                userId: ctx.auth.user.id,
                nodes:{
                    create:{
                        type: NodeType.INITIAL,
                        position: { x: 0 ,y: 0},
                        name: NodeType.INITIAL
                    }
                }
            }
        })
    }),

    remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ctx, input})=> {
        return prisma.workflow.delete({
            where:{
                id: input.id,
                userId: ctx.auth.user.id
            },
        })
    }),

    updateName: protectedProcedure
    .input(z.object({
        id: z.string(),
        name: z.string().min(1)
    }))
    .mutation(({ctx, input})=>{
        return prisma.workflow.update({
            where: {
                id: input.id,
                userId: ctx.auth.user.id
            },
            data:{
                name: input.name
            }
        })
    }),


    update: protectedProcedure
    .input(z.object({
        id: z.string(),
        nodes: z.array(
            z.object({
                id:z.string(),
                type: z.string().nullish(),
                position: z.object(
                    { x: z.number(), y: z.number() }
                ),
                data:z.record(z.string(), z.any()).optional(),
            })
        ),
        edges: z.array(
            z.object({
                source: z.string(),
                target: z.string(),
                sourceHandle: z.string().nullable(),
                targetHandle: z.string().nullable()
            })
        )
    }))
    .mutation( async({ctx, input})=>{

        const { edges, id, nodes } = input; 
        
        const workflow = await prisma.workflow.findUniqueOrThrow({
            where:{
                id,
                userId: ctx.auth.user.id
            }
        })

        // Transaction to ensure consitency
        return await prisma.$transaction( async(tx)=>{
            // Delete existing nodes and connections (cascade deletes connections)
            await tx.node.deleteMany({
                where: {
                    workflowId: id
                }
            })

            // create nodes
            await tx.node.createMany({
                data: nodes.map(( node )=> ( {
                    id: node.id,
                    workflowId: id,
                    name: node.type || "unknown",
                    type: node.type as NodeType,
                    position: node.position,
                    data: node.data || {}
                } ))
            })

            // create connections
            await tx.connection.createMany({
                data: edges.map((edge)=> ({
                    workflowId: id,
                    fromNodeId: edge.source,
                    toNodeId: edge.target,
                    fromOutput: edge.sourceHandle || "main",
                    toInput: edge.targetHandle || "main",
                })),
            })

            // Update workflows updateAt timestamp
            await tx.workflow.update({
                where: { id },
                data: {
                    updatedAt: new Date()
                },
            })

            return workflow;
        })
    }),


    getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async({ctx, input})=>{
        const workflow= await prisma.workflow.findUniqueOrThrow({
            where: {id: input.id , userId:ctx.auth.user.id },
            include:{ nodes: true, connections:true }
        })

        // Transforming the server node to react-flow
        const nodes: Node[] =workflow.nodes.map((node)=>({
            id: node.id,
            type: node.type,
            position: node.position as { x: number, y:number },
            data: (node.data as Record<string, unknown>) || {}
        }))

        // Transform the server connections to react-flow edges
        const edges: Edge[] =workflow.connections.map((connection)=>({
            id: connection.id,
            source: connection.fromNodeId,
            target: connection.toNodeId,
            sourceHandle: connection.fromOutput,
            targetHandle: connection.toInput,
        }))

        return {
            id: workflow.id,
            name: workflow.name,
            nodes,
            edges
        }
    }),


    getMany: protectedProcedure
    .input(
        z.object({
            page: z.number().default(PAGINATION.DEFAULT_PAGE),
            pageSize: z.number().min(PAGINATION.MIN_PAGE_SIZE).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
            search: z.string().default(""),
        })
    )
    .query(async({ctx, input})=>{

        const { page, pageSize, search} = input;
        const [items, totalCount]= await Promise.all([
            prisma.workflow.findMany({
                skip: (page - 1 ) * pageSize, 
                take: pageSize,

                where: {
                     userId:ctx.auth.user.id ,
                     name: {
                        contains: search,
                        mode: "insensitive",
                     }
                },
                orderBy:{
                    updatedAt:"desc"
                },
            }),
            prisma.workflow.count({
                where:{
                    userId: ctx.auth.user.id,
                    name:{
                        contains: search,
                        mode: "insensitive"
                    }
                }
            })
        
        ])
        
        const totalPages= Math.ceil(totalCount / pageSize);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        return {
            items: items,
            page,
            pageSize,
            totalPages,
            hasNextPage,
            hasPreviousPage,
        }
    }),

})