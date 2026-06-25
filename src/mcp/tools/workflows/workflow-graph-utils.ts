import { createHash } from "crypto";
import prisma from "@/lib/db";
import { CredentialType, NodeType, type Prisma } from "@/generated/prisma";
import {
  getNodeManifest,
  NODE_MANIFESTS,
  type NodeManifest,
} from "@/features/workflows/node-manifest";

export type WorkflowGraphNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowGraphEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type WorkflowMissingField = {
  nodeId: string;
  nodeType: NodeType;
  field: string;
  label: string;
  reason: string;
};

export type WorkflowValidationReport = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: WorkflowMissingField[];
  sideEffects: Array<{
    nodeId: string;
    nodeType: NodeType;
    label: string;
    riskLevel: string;
  }>;
  graph: {
    nodeCount: number;
    edgeCount: number;
    triggerCount: number;
  };
};

export const TRIGGER_NODE_TYPES = new Set<NodeType>([
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
]);

export function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

export function asGraphNodes(value: unknown): WorkflowGraphNode[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((node) => {
      if (!node || typeof node !== "object") return null;
      const record = node as Record<string, unknown>;
      const position = record.position as { x?: unknown; y?: unknown } | undefined;
      const data = record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : {};

      if (typeof record.id !== "string") return null;
      if (!Object.values(NodeType).includes(record.type as NodeType)) return null;

      return {
        id: record.id,
        type: record.type as NodeType,
        position: {
          x: typeof position?.x === "number" ? position.x : 0,
          y: typeof position?.y === "number" ? position.y : 0,
        },
        data,
      };
    })
    .filter((node): node is WorkflowGraphNode => Boolean(node));
}

export function asGraphEdges(value: unknown): WorkflowGraphEdge[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((edge): WorkflowGraphEdge | null => {
      if (!edge || typeof edge !== "object") return null;
      const record = edge as Record<string, unknown>;
      if (typeof record.source !== "string" || typeof record.target !== "string") {
        return null;
      }

      return {
        id: typeof record.id === "string" ? record.id : undefined,
        source: record.source,
        target: record.target,
        sourceHandle: typeof record.sourceHandle === "string" ? record.sourceHandle : "main",
        targetHandle: typeof record.targetHandle === "string" ? record.targetHandle : "main",
      };
    })
    .filter((edge): edge is WorkflowGraphEdge => Boolean(edge));
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function detectCycle(nodes: WorkflowGraphNode[], edges: WorkflowGraphEdge[]): boolean {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}

function findUnreachableNodes(
  nodes: WorkflowGraphNode[],
  edges: WorkflowGraphEdge[],
): WorkflowGraphNode[] {
  const triggers = nodes.filter((node) => TRIGGER_NODE_TYPES.has(node.type));
  if (triggers.length === 0) return nodes;

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const queue = triggers.map((node) => node.id);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    queue.push(...(adjacency.get(current) || []));
  }

  return nodes.filter((node) => !visited.has(node.id));
}

export async function validateWorkflowGraph(params: {
  userId: string;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}): Promise<WorkflowValidationReport> {
  const { userId, nodes, edges } = params;
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: WorkflowMissingField[] = [];
  const sideEffects: WorkflowValidationReport["sideEffects"] = [];

  const nodeIds = new Set<string>();
  const variableNames = new Map<string, string>();
  const requiredCredentialIds = new Map<string, CredentialType>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);

    let manifest: NodeManifest | undefined;
    try {
      manifest = getNodeManifest(node.type);
    } catch {
      errors.push(`Unsupported node type: ${node.type}`);
      continue;
    }

    if (manifest.sideEffect) {
      sideEffects.push({
        nodeId: node.id,
        nodeType: node.type,
        label: manifest.label,
        riskLevel: manifest.riskLevel,
      });
    }

    for (const field of manifest.requiredFields) {
      if (isMissing(node.data[field.name])) {
        missingFields.push({
          nodeId: node.id,
          nodeType: node.type,
          field: field.name,
          label: field.label,
          reason: field.description,
        });
      }
    }

    const variableName = node.data.variableName;
    if (typeof variableName === "string" && variableName.trim()) {
      if (variableNames.has(variableName)) {
        errors.push(
          `Duplicate result name "${variableName}" on nodes ${variableNames.get(variableName)} and ${node.id}.`,
        );
      }
      variableNames.set(variableName, node.id);
    }

    if (manifest.credentialType) {
      const credentialId = node.data.credentialId;
      if (typeof credentialId === "string" && credentialId.trim()) {
        requiredCredentialIds.set(credentialId, manifest.credentialType);
      }
    }
  }

  const triggerNodes = nodes.filter((node) => TRIGGER_NODE_TYPES.has(node.type));
  const manualTriggers = nodes.filter((node) => node.type === NodeType.MANUAL_TRIGGER);

  if (nodes.length === 0) {
    errors.push("Workflow has no nodes.");
  }
  if (triggerNodes.length === 0) {
    errors.push("Workflow needs at least one trigger node before it can run.");
  }
  if (manualTriggers.length > 1) {
    errors.push("Workflow can only have one manual trigger.");
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Connection starts from missing node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Connection points to missing node: ${edge.target}`);
    }
  }

  if (detectCycle(nodes, edges)) {
    errors.push("Workflow graph has a cycle. Steps must flow forward without loops.");
  }

  for (const node of findUnreachableNodes(nodes, edges)) {
    if (!TRIGGER_NODE_TYPES.has(node.type)) {
      errors.push(`Node ${node.id} (${node.type}) is not reachable from any trigger.`);
    }
  }

  if (missingFields.length > 0) {
    errors.push(`${missingFields.length} required field(s) are missing.`);
  }

  if (requiredCredentialIds.size > 0) {
    const credentials = await prisma.credential.findMany({
      where: {
        userId,
        id: { in: [...requiredCredentialIds.keys()] },
      },
      select: { id: true, type: true },
    });
    const credentialsById = new Map(credentials.map((credential) => [credential.id, credential.type]));

    for (const [credentialId, expectedType] of requiredCredentialIds) {
      const actualType = credentialsById.get(credentialId);
      if (!actualType) {
        errors.push(`Credential ${credentialId} was not found for this user.`);
      } else if (actualType !== expectedType) {
        errors.push(
          `Credential ${credentialId} has type ${actualType}, but ${expectedType} is required.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingFields,
    sideEffects,
    graph: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      triggerCount: triggerNodes.length,
    },
  };
}

export function explainGraph(params: {
  name: string;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  validation?: WorkflowValidationReport | null;
}) {
  const { name, nodes, edges, validation } = params;
  const nodeLabel = (node: WorkflowGraphNode) => getNodeManifest(node.type).label;
  const orderedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

  const plainSteps = orderedNodes.map((node, index) => {
    const manifest = getNodeManifest(node.type);
    return {
      step: index + 1,
      nodeId: node.id,
      label: manifest.label,
      explanation: manifest.beginnerDescription,
      setup: manifest.setup,
      outputs: manifest.outputs,
    };
  });

  return {
    title: name,
    beginnerExplanation:
      orderedNodes.length === 0
        ? "This workflow has no steps yet."
        : `This workflow starts with ${nodeLabel(orderedNodes[0])} and then runs ${Math.max(orderedNodes.length - 1, 0)} more step(s).`,
    technicalSummary: {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        dataKeys: Object.keys(node.data),
      })),
      edges,
    },
    dataFlow: edges.map((edge) => ({
      from: edge.source,
      to: edge.target,
      explanation: `${edge.source} passes its result to ${edge.target}.`,
    })),
    setupChecklist: plainSteps.flatMap((step) =>
      step.setup.map((item) => ({
        nodeId: step.nodeId,
        node: step.label,
        item,
      })),
    ),
    steps: plainSteps,
    validation: validation || null,
    whatHappensWhenItRuns: plainSteps.map((step) => step.explanation),
  };
}

export async function getWorkflowGraph(workflowId: string, userId: string) {
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id: workflowId, userId },
    include: { nodes: true, connections: true },
  });

  const nodes = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position as { x: number; y: number },
    data: (node.data as Record<string, unknown>) || {},
  }));
  const edges = workflow.connections.map((connection) => ({
    id: connection.id,
    source: connection.fromNodeId,
    target: connection.toNodeId,
    sourceHandle: connection.fromOutput,
    targetHandle: connection.toInput,
  }));

  return { workflow, nodes, edges };
}

export async function createWorkflowVersion(params: {
  workflowId: string;
  userId: string;
  createdByTool: string;
  summary?: string;
}) {
  const { workflow, nodes, edges } = await getWorkflowGraph(
    params.workflowId,
    params.userId,
  );

  return prisma.workflowVersion.create({
    data: {
      workflowId: workflow.id,
      userId: params.userId,
      name: workflow.name,
      nodes: nodes as unknown as Prisma.InputJsonValue,
      edges: edges as unknown as Prisma.InputJsonValue,
      summary: params.summary,
      createdByTool: params.createdByTool,
    },
  });
}

export async function replaceWorkflowGraph(params: {
  workflowId: string;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx || prisma;

  await client.node.deleteMany({ where: { workflowId: params.workflowId } });

  if (params.nodes.length > 0) {
    await client.node.createMany({
      data: params.nodes.map((node) => ({
        id: node.id,
        workflowId: params.workflowId,
        name: node.type,
        type: node.type,
        position: node.position,
        data: node.data as Prisma.InputJsonValue,
        credentialId:
          typeof node.data.credentialId === "string" && node.data.credentialId
            ? node.data.credentialId
            : null,
      })),
    });
  }

  if (params.edges.length > 0) {
    await client.connection.createMany({
      data: params.edges.map((edge) => ({
        workflowId: params.workflowId,
        fromNodeId: edge.source,
        toNodeId: edge.target,
        fromOutput: edge.sourceHandle || "main",
        toInput: edge.targetHandle || "main",
      })),
    });
  }

  return client.workflow.update({
    where: { id: params.workflowId },
    data: { updatedAt: new Date() },
  });
}

export function getManifestForNodeType(type: NodeType): NodeManifest {
  return NODE_MANIFESTS.find((manifest) => manifest.type === type) || getNodeManifest(type);
}
