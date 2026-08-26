"use client";

import { useMemo } from "react";
import { addEdge, type Connection, type Edge, type Node } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma";
import {
  applyGraphChangeAtom,
  pendingEdgeInsertAtom,
  type GraphSnapshot,
} from "../store/atoms";

export function useGraphMutations() {
  const applyChange = useSetAtom(applyGraphChangeAtom);
  const setPendingEdgeInsert = useSetAtom(pendingEdgeInsertAtom);

  return useMemo(
    () => ({
      /** Appends a node, replacing the INITIAL placeholder if present. */
      addNode(node: Node) {
        applyChange(({ nodes, edges }) => {
          const hasInitial = nodes.some((n) => n.type === NodeType.INITIAL);
          if (hasInitial) {
            return {
              // The INITIAL placeholder never has connections in a fresh graph.
              nodes: [...nodes.filter((n) => n.type !== NodeType.INITIAL), node],
              edges,
            };
          }
          return { nodes: [...nodes, node], edges };
        });
      },

      /** Deletes a node together with every edge attached to it. */
      deleteNode(nodeId: string) {
        applyChange(({ nodes, edges }) => ({
          nodes: nodes.filter((n) => n.id !== nodeId),
          edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        }));
      },

      /** Merges partial config into a node's data. */
      updateNodeData(nodeId: string, data: Record<string, unknown>) {
        applyChange(({ nodes, edges }) => ({
          nodes: nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
          ),
          edges,
        }));
      },

      connectEdge(connection: Connection) {
        applyChange(({ nodes, edges }) => ({
          nodes,
          edges: addEdge(connection, edges),
        }));
      },

      deleteEdge(edgeId: string) {
        applyChange(({ nodes, edges }) => ({
          nodes,
          edges: edges.filter((e) => e.id !== edgeId),
        }));
      },

      reconnectEdge(oldEdgeId: string, connection: Connection) {
        applyChange(({ nodes, edges }) => ({
          nodes,
          edges: edges
            .filter((e) => e.id !== oldEdgeId)
            .concat({
              id: `e-${createId()}`,
              source: connection.source,
              target: connection.target,
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
            } satisfies Edge),
        }));
      },

      /**
       * Inserts a new node in the middle of an existing edge, rewiring the
       * connections around it.
       */
      insertNodeOnEdge(edgeId: string, node: Node) {
        setPendingEdgeInsert(null);
        applyChange(({ nodes, edges }) => {
          const edge = edges.find((e) => e.id === edgeId);
          if (!edge) return { nodes, edges };

          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          const position =
            sourceNode && targetNode
              ? {
                  x: (sourceNode.position.x + targetNode.position.x) / 2,
                  y: (sourceNode.position.y + targetNode.position.y) / 2,
                }
              : node.position;

          const remainingEdges = edges.filter((e) => e.id !== edgeId);
          return {
            nodes: [
              ...nodes.filter((n) => n.type !== NodeType.INITIAL),
              { ...node, position },
            ],
            edges: [
              ...remainingEdges,
              {
                id: `e-${createId()}`,
                source: edge.source,
                target: node.id,
                sourceHandle: edge.sourceHandle ?? "main",
                targetHandle: "main",
              } satisfies Edge,
              {
                id: `e-${createId()}`,
                source: node.id,
                target: edge.target,
                sourceHandle: "main",
                targetHandle: edge.targetHandle ?? "main",
              } satisfies Edge,
            ],
          };
        });
      },

      /** Bulk replace used by import/restore — participates in undo history. */
      replaceWithHistory(snapshot: GraphSnapshot) {
        applyChange(() => snapshot);
      },
    }),
    [applyChange, setPendingEdgeInsert],
  );
}
