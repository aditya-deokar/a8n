import { createId } from "@paralleldrive/cuid2";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import prisma from "@/lib/db";
import { NodeType, type Prisma } from "@/generated/prisma";
import { requireScope } from "@/mcp/middleware/scope-guard";
import { requireActiveSubscription } from "@/mcp/middleware/subscription-guard";
import { withErrorBoundary } from "@/mcp/middleware/error-boundary";
import { createAuditContext } from "@/mcp/middleware/audit-logger";
import { mcpJsonResponse } from "@/mcp/shared/sanitize";
import { getMcpAuth, type McpToolContext } from "@/mcp/shared/auth-context";
import {
  asGraphEdges,
  asGraphNodes,
  createWorkflowVersion,
  explainGraph,
  getWorkflowGraph,
  replaceWorkflowGraph,
  stableHash,
  validateWorkflowGraph,
  type WorkflowGraphEdge,
  type WorkflowGraphNode,
  type WorkflowValidationReport,
} from "./workflow-graph-utils";

type WorkflowPlan = {
  goal: string;
  audience: string;
  preferredApps: string[];
  plainLanguageSteps: string[];
  requiredApps: string[];
  missingQuestions: string[];
  risks: string[];
  estimatedSetupEffort: "low" | "medium" | "high";
  suggestedTemplate: string | null;
  nodeTypes: NodeType[];
};

const SENSITIVE_ANSWER_KEYS = [
  "value",
  "secret",
  "password",
  "token",
  "apiKey",
  "rawKey",
  "webhookUrl",
];

const AI_NODE_TYPES = new Set<NodeType>([
  NodeType.OPENAI,
  NodeType.ANTHROPIC,
  NodeType.GEMINI,
]);

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function planFromGoal(goal: string, audience = "beginner", preferredApps: string[] = []): WorkflowPlan {
  const text = `${goal} ${preferredApps.join(" ")}`.toLowerCase();
  const nodeTypes: NodeType[] = [];
  const requiredApps = new Set<string>();
  const risks: string[] = [];

  if (includesAny(text, ["google form", "form response", "submission", "survey"])) {
    nodeTypes.push(NodeType.GOOGLE_FORM_TRIGGER);
    requiredApps.add("Google Forms");
  } else if (includesAny(text, ["stripe", "payment", "checkout", "invoice", "subscription"])) {
    nodeTypes.push(NodeType.STRIPE_TRIGGER);
    requiredApps.add("Stripe");
  } else {
    nodeTypes.push(NodeType.MANUAL_TRIGGER);
  }

  if (includesAny(text, ["http", "api", "fetch", "webhook", "rest"])) {
    nodeTypes.push(NodeType.HTTP_REQUEST);
    requiredApps.add("External API");
  }

  if (includesAny(text, ["gemini", "google ai"])) {
    nodeTypes.push(NodeType.GEMINI);
    requiredApps.add("Gemini");
  } else if (includesAny(text, ["anthropic", "claude"])) {
    nodeTypes.push(NodeType.ANTHROPIC);
    requiredApps.add("Anthropic");
  } else if (includesAny(text, ["openai", "gpt", "chatgpt"])) {
    nodeTypes.push(NodeType.OPENAI);
    requiredApps.add("OpenAI");
  } else if (includesAny(text, ["summarize", "classify", "rewrite", "draft", "ai "])) {
    nodeTypes.push(NodeType.GEMINI);
    requiredApps.add("Gemini");
  }

  if (includesAny(text, ["email", "mail", "send to respondent"])) {
    nodeTypes.push(NodeType.EMAIL);
    requiredApps.add("Email/SMTP");
    risks.push("This workflow can send email to real people.");
  }
  if (includesAny(text, ["slack"])) {
    nodeTypes.push(NodeType.SLACK);
    requiredApps.add("Slack");
    risks.push("This workflow can post messages to Slack.");
  }
  if (includesAny(text, ["discord"])) {
    nodeTypes.push(NodeType.DISCORD);
    requiredApps.add("Discord");
    risks.push("This workflow can post messages to Discord.");
  }
  if (includesAny(text, ["sheet", "spreadsheet", "google sheets", "append row", "save row"])) {
    nodeTypes.push(NodeType.GOOGLE_SHEETS);
    requiredApps.add("Google Sheets");
  }

  const suggestedTemplate =
    nodeTypes.includes(NodeType.GOOGLE_FORM_TRIGGER) &&
    nodeTypes.some((type) => AI_NODE_TYPES.has(type)) &&
    nodeTypes.includes(NodeType.EMAIL)
      ? "google-form-ai-email"
      : nodeTypes.includes(NodeType.STRIPE_TRIGGER) && nodeTypes.includes(NodeType.SLACK)
        ? "stripe-slack-alert"
        : nodeTypes.includes(NodeType.HTTP_REQUEST) && nodeTypes.includes(NodeType.GOOGLE_SHEETS)
          ? "http-to-sheets"
          : null;

  return {
    goal,
    audience,
    preferredApps,
    plainLanguageSteps: nodeTypes.map((type, index) => `${index + 1}. Add ${type.replaceAll("_", " ").toLowerCase()} step.`),
    requiredApps: [...requiredApps],
    missingQuestions: [
      "Which saved credentials should this workflow use?",
      "What exact message, email, row, or API fields should be filled in?",
      "Should the workflow be tested before enabling real side effects?",
    ],
    risks,
    estimatedSetupEffort: requiredApps.size > 3 ? "high" : requiredApps.size > 1 ? "medium" : "low",
    suggestedTemplate,
    nodeTypes,
  };
}

function defaultDataForNode(type: NodeType, goal: string, aiVariableName: string | null): Record<string, unknown> {
  switch (type) {
    case NodeType.HTTP_REQUEST:
      return { variableName: "apiResult", endpoint: "", method: "GET", body: "" };
    case NodeType.OPENAI:
      return {
        variableName: "openAiResult",
        credentialId: "",
        userPrompt: `Help with this workflow goal: ${goal}`,
      };
    case NodeType.ANTHROPIC:
      return {
        variableName: "anthropicResult",
        credentialId: "",
        userPrompt: `Help with this workflow goal: ${goal}`,
      };
    case NodeType.GEMINI:
      return {
        variableName: "geminiResult",
        credentialId: "",
        userPrompt: includesAny(goal.toLowerCase(), ["form", "submission"])
          ? "Summarize this form response: {{json googleForm.responses}}"
          : `Help with this workflow goal: ${goal}`,
      };
    case NodeType.EMAIL:
      return {
        variableName: "emailResult",
        credentialId: "",
        to: includesAny(goal.toLowerCase(), ["form", "respondent"])
          ? "{{googleForm.respondentEmail}}"
          : "",
        subject: "Workflow update",
        body: aiVariableName ? `{{${aiVariableName}.text}}` : "The workflow has completed.",
      };
    case NodeType.SLACK:
      return {
        variableName: "slackMessage",
        webhookUrl: "",
        content: aiVariableName ? `{{${aiVariableName}.text}}` : "Workflow update",
      };
    case NodeType.DISCORD:
      return {
        variableName: "discordMessage",
        webhookUrl: "",
        content: aiVariableName ? `{{${aiVariableName}.text}}` : "Workflow update",
      };
    case NodeType.GOOGLE_SHEETS:
      return {
        variableName: "sheetResult",
        credentialId: "",
        spreadsheetId: "",
        sheetName: "Sheet1",
        rowJson: aiVariableName
          ? `["{{${aiVariableName}.text}}"]`
          : "[\"Workflow completed\"]",
      };
    default:
      return {};
  }
}

function buildDraftGraph(plan: WorkflowPlan): {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
} {
  const aiType = plan.nodeTypes.find((type) => AI_NODE_TYPES.has(type));
  const aiVariableName = aiType === NodeType.OPENAI
    ? "openAiResult"
    : aiType === NodeType.ANTHROPIC
      ? "anthropicResult"
      : aiType === NodeType.GEMINI
        ? "geminiResult"
        : null;

  const nodes = plan.nodeTypes.map((type, index) => ({
    id: createId(),
    type,
    position: { x: index * 320, y: 0 },
    data: defaultDataForNode(type, plan.goal, aiVariableName),
  }));

  const edges = nodes.slice(1).map((node, index) => ({
    source: nodes[index].id,
    target: node.id,
    sourceHandle: "main",
    targetHandle: "main",
  }));

  return { nodes, edges };
}

function assertNoSensitiveAnswers(value: unknown, path = "answers"): void {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (SENSITIVE_ANSWER_KEYS.some((sensitive) => normalized.includes(sensitive.toLowerCase()))) {
      throw new Error(
        `Refusing to accept sensitive value at ${path}.${key}. Use the dashboard or credential tools for secrets.`,
      );
    }
    assertNoSensitiveAnswers(nested, `${path}.${key}`);
  }
}

function applyAnswersToNodes(
  nodes: WorkflowGraphNode[],
  answers: Record<string, unknown>,
): WorkflowGraphNode[] {
  return nodes.map((node) => {
    const nextData = { ...node.data };
    const nodeAnswers = answers[node.id];

    if (nodeAnswers && typeof nodeAnswers === "object" && !Array.isArray(nodeAnswers)) {
      Object.assign(nextData, nodeAnswers);
    }

    for (const [key, value] of Object.entries(answers)) {
      const [nodeId, field] = key.split(".");
      if (nodeId === node.id && field) {
        nextData[field] = value;
      } else if (!key.includes(".") && key in nextData) {
        nextData[key] = value;
      }
    }

    return { ...node, data: nextData };
  });
}

function buildGraphDiff(
  beforeNodes: WorkflowGraphNode[],
  beforeEdges: WorkflowGraphEdge[],
  afterNodes: WorkflowGraphNode[],
  afterEdges: WorkflowGraphEdge[],
) {
  const beforeById = new Map(beforeNodes.map((node) => [node.id, node]));
  const afterById = new Map(afterNodes.map((node) => [node.id, node]));
  const beforeEdgeKeys = new Set(beforeEdges.map((edge) => `${edge.source}->${edge.target}`));
  const afterEdgeKeys = new Set(afterEdges.map((edge) => `${edge.source}->${edge.target}`));

  return {
    addedNodes: afterNodes.filter((node) => !beforeById.has(node.id)),
    removedNodes: beforeNodes.filter((node) => !afterById.has(node.id)),
    changedNodes: afterNodes.filter((node) => {
      const before = beforeById.get(node.id);
      return before && JSON.stringify(before) !== JSON.stringify(node);
    }),
    addedEdges: afterEdges.filter((edge) => !beforeEdgeKeys.has(`${edge.source}->${edge.target}`)),
    removedEdges: beforeEdges.filter((edge) => !afterEdgeKeys.has(`${edge.source}->${edge.target}`)),
  };
}

async function saveDraftRevision(draftId: string, createdByTool: string) {
  const draft = await prisma.workflowDraft.findUniqueOrThrow({
    where: { id: draftId },
  });

  return prisma.workflowDraftRevision.create({
    data: {
      draftId,
      createdByTool,
      snapshot: {
        name: draft.name,
        goal: draft.goal,
        status: draft.status,
        plan: draft.plan,
        nodes: draft.nodes,
        edges: draft.edges,
        missingFields: draft.missingFields,
        validation: draft.validation,
      } as Prisma.InputJsonValue,
    },
  });
}

async function loadDraft(draftId: string, userId: string) {
  return prisma.workflowDraft.findUniqueOrThrow({
    where: { id: draftId, userId },
  });
}

export function registerPlanWorkflowFromGoal(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "plan_workflow_from_goal",
    "Turn a plain-language automation goal into beginner-friendly steps, required apps, missing questions, risks, and a suggested workflow template. Does not mutate data.",
    {
      goal: z.string().min(1).describe("Plain-language automation goal."),
      audience: z.string().optional().describe("Audience level, defaults to beginner."),
      preferredApps: z.array(z.string()).optional().describe("Apps the user prefers to use."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "system:read");

      return withErrorBoundary("plan_workflow_from_goal", async () => {
        const plan = planFromGoal(args.goal, args.audience, args.preferredApps || []);
        return mcpJsonResponse(plan);
      });
    },
  );
}

export function registerCreateWorkflowDraft(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "create_workflow_draft",
    "Create a saved workflow draft from a plain-language goal. The draft is not applied to a real workflow until validate_workflow_draft and apply_workflow_draft are called with approval.",
    {
      goal: z.string().min(1).describe("Plain-language automation goal."),
      name: z.string().optional().describe("Optional draft/workflow name."),
      audience: z.string().optional().describe("Audience level, defaults to beginner."),
      preferredApps: z.array(z.string()).optional().describe("Apps the user prefers to use."),
      workflowId: z.string().optional().describe("Optional existing workflow ID this draft will modify."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "create_workflow_draft",
        input: { goal: args.goal, workflowId: args.workflowId },
      });

      return withErrorBoundary("create_workflow_draft", async () => {
        if (!args.workflowId) {
          await requireActiveSubscription(auth.userId);
        } else {
          await prisma.workflow.findUniqueOrThrow({
            where: { id: args.workflowId, userId: auth.userId },
          });
        }

        const plan = planFromGoal(args.goal, args.audience, args.preferredApps || []);
        const { nodes, edges } = buildDraftGraph(plan);
        const validation = await validateWorkflowGraph({ userId: auth.userId, nodes, edges });
        const draft = await prisma.workflowDraft.create({
          data: {
            name: args.name || plan.suggestedTemplate || "New workflow draft",
            goal: args.goal,
            workflowId: args.workflowId,
            userId: auth.userId,
            plan: plan as unknown as Prisma.InputJsonValue,
            nodes: nodes as unknown as Prisma.InputJsonValue,
            edges: edges as unknown as Prisma.InputJsonValue,
            missingFields: validation.missingFields as unknown as Prisma.InputJsonValue,
            validation: validation as unknown as Prisma.InputJsonValue,
            status: validation.valid ? "READY" : "DRAFT",
          },
        });

        await saveDraftRevision(draft.id, "create_workflow_draft");
        audit.success();

        return mcpJsonResponse({
          draftId: draft.id,
          status: draft.status,
          plan,
          nodes,
          edges,
          validation,
          nextStep: validation.valid
            ? "Review the explanation and preview, then call apply_workflow_draft with approval."
            : "Answer missing non-sensitive fields, connect credentials, then call validate_workflow_draft.",
        });
      });
    },
  );
}

export function registerAnswerWorkflowDraftQuestions(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "answer_workflow_draft_questions",
    "Update a draft with non-sensitive answers. Supports keys like nodeId.field, nodeId: { field }, or unique field names. Refuses secret-looking values.",
    {
      draftId: z.string().describe("Workflow draft ID."),
      answers: z.record(z.string(), z.unknown()).describe("Non-sensitive answers for missing draft fields."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("answer_workflow_draft_questions", async () => {
        assertNoSensitiveAnswers(args.answers);

        const draft = await loadDraft(args.draftId, auth.userId);
        const nodes = applyAnswersToNodes(asGraphNodes(draft.nodes), args.answers);
        const edges = asGraphEdges(draft.edges);
        const validation = await validateWorkflowGraph({ userId: auth.userId, nodes, edges });

        const updated = await prisma.workflowDraft.update({
          where: { id: draft.id },
          data: {
            nodes: nodes as unknown as Prisma.InputJsonValue,
            missingFields: validation.missingFields as unknown as Prisma.InputJsonValue,
            validation: validation as unknown as Prisma.InputJsonValue,
            status: validation.valid ? "READY" : "DRAFT",
          },
        });

        await saveDraftRevision(updated.id, "answer_workflow_draft_questions");

        return mcpJsonResponse({
          draftId: updated.id,
          status: updated.status,
          nodes,
          validation,
        });
      });
    },
  );
}

export function registerValidateWorkflowDraft(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.registerTool(
    "validate_workflow_draft",
    {
      description:
        "Validate a workflow draft for graph safety, missing required fields, credential compatibility, duplicate result names, unreachable nodes, and side-effect warnings.",
      inputSchema: {
        draftId: z.string().describe("Workflow draft ID."),
      },
      outputSchema: {
        draftId: z.string(),
        status: z.string(),
        validation: z.object({}).passthrough(),
      },
      annotations: { readOnlyHint: false },
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      return withErrorBoundary("validate_workflow_draft", async () => {
        const draft = await loadDraft(args.draftId, auth.userId);
        const nodes = asGraphNodes(draft.nodes);
        const edges = asGraphEdges(draft.edges);
        const validation = await validateWorkflowGraph({ userId: auth.userId, nodes, edges });
        const updated = await prisma.workflowDraft.update({
          where: { id: draft.id },
          data: {
            missingFields: validation.missingFields as unknown as Prisma.InputJsonValue,
            validation: validation as unknown as Prisma.InputJsonValue,
            status: validation.valid ? "READY" : "DRAFT",
          },
        });

        return mcpJsonResponse({
          draftId: updated.id,
          status: updated.status,
          validation,
        });
      });
    },
  );
}

export function registerExplainWorkflow(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "explain_workflow",
    "Explain a draft or saved workflow in beginner-friendly language, including data flow, setup checklist, technical summary, and what happens when it runs.",
    {
      draftId: z.string().optional().describe("Draft ID to explain."),
      workflowId: z.string().optional().describe("Saved workflow ID to explain."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("explain_workflow", async () => {
        if (!args.draftId && !args.workflowId) {
          throw new Error("Provide either draftId or workflowId.");
        }

        if (args.draftId) {
          const draft = await loadDraft(args.draftId, auth.userId);
          const nodes = asGraphNodes(draft.nodes);
          const edges = asGraphEdges(draft.edges);
          const validation = draft.validation as WorkflowValidationReport | null;
          return mcpJsonResponse({
            kind: "draft",
            draftId: draft.id,
            ...explainGraph({ name: draft.name, nodes, edges, validation }),
          });
        }

        const { workflow, nodes, edges } = await getWorkflowGraph(args.workflowId!, auth.userId);
        const validation = await validateWorkflowGraph({ userId: auth.userId, nodes, edges });
        return mcpJsonResponse({
          kind: "workflow",
          workflowId: workflow.id,
          ...explainGraph({ name: workflow.name, nodes, edges, validation }),
        });
      });
    },
  );
}

export function registerPreviewWorkflowDiff(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "preview_workflow_diff",
    "Preview the difference between a workflow draft and a saved workflow before applying. Returns side effects, rollback plan, and confirmation hash.",
    {
      draftId: z.string().describe("Draft ID to preview."),
      workflowId: z.string().optional().describe("Optional saved workflow ID; defaults to the draft's workflowId."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:read");

      return withErrorBoundary("preview_workflow_diff", async () => {
        const draft = await loadDraft(args.draftId, auth.userId);
        const targetWorkflowId = args.workflowId || draft.workflowId;
        const draftNodes = asGraphNodes(draft.nodes);
        const draftEdges = asGraphEdges(draft.edges);
        const before = targetWorkflowId
          ? await getWorkflowGraph(targetWorkflowId, auth.userId)
          : { nodes: [], edges: [] };
        const validation = await validateWorkflowGraph({
          userId: auth.userId,
          nodes: draftNodes,
          edges: draftEdges,
        });
        const diff = buildGraphDiff(before.nodes, before.edges, draftNodes, draftEdges);
        const confirmationSummary = {
          draftId: draft.id,
          workflowId: targetWorkflowId || null,
          diff,
          validationValid: validation.valid,
        };

        return mcpJsonResponse({
          draftId: draft.id,
          workflowId: targetWorkflowId || null,
          diff,
          validation,
          rollbackPlan: targetWorkflowId
            ? "A workflow version snapshot will be created before applying this draft."
            : "This creates a new workflow; rollback is deleting or editing the new workflow.",
          approval: {
            required: true,
            confirmationHash: stableHash(confirmationSummary),
            instruction:
              "Call apply_workflow_draft with approved: true and this confirmationHash after the user approves.",
          },
        });
      });
    },
  );
}

export function registerApplyWorkflowDraft(
  server: McpServer,
  context: McpToolContext = {},
) {
  server.tool(
    "apply_workflow_draft",
    "Apply a validated workflow draft to a new or existing workflow. Requires approved: true and the confirmation hash from preview_workflow_diff.",
    {
      draftId: z.string().describe("Draft ID to apply."),
      workflowId: z.string().optional().describe("Optional saved workflow ID; defaults to the draft's workflowId."),
      approved: z.boolean().default(false).describe("Must be true after explicit user approval."),
      confirmationHash: z.string().optional().describe("Hash returned by preview_workflow_diff."),
    },
    async (args, extra) => {
      const auth = getMcpAuth(extra, context);
      requireScope(auth, "workflows:write");

      const audit = createAuditContext({
        userId: auth.userId,
        apiKeyId: auth.apiKeyId,
        authMethod: auth.method,
        tool: "apply_workflow_draft",
        input: { draftId: args.draftId, workflowId: args.workflowId, approved: args.approved },
      });

      return withErrorBoundary("apply_workflow_draft", async () => {
        const draft = await loadDraft(args.draftId, auth.userId);
        const targetWorkflowId = args.workflowId || draft.workflowId;
        const nodes = asGraphNodes(draft.nodes);
        const edges = asGraphEdges(draft.edges);
        const validation = await validateWorkflowGraph({ userId: auth.userId, nodes, edges });

        if (!validation.valid) {
          return mcpJsonResponse({
            applied: false,
            reason: "Draft validation failed.",
            validation,
          });
        }

        const before = targetWorkflowId
          ? await getWorkflowGraph(targetWorkflowId, auth.userId)
          : { nodes: [], edges: [] };
        const diff = buildGraphDiff(before.nodes, before.edges, nodes, edges);
        const confirmationSummary = {
          draftId: draft.id,
          workflowId: targetWorkflowId || null,
          diff,
          validationValid: validation.valid,
        };
        const expectedHash = stableHash(confirmationSummary);

        if (!args.approved || args.confirmationHash !== expectedHash) {
          return mcpJsonResponse({
            applied: false,
            approvalRequired: true,
            confirmationHash: expectedHash,
            diff,
            validation,
          });
        }

        let workflowId = targetWorkflowId;
        if (!workflowId) {
          await requireActiveSubscription(auth.userId);
          const workflow = await prisma.workflow.create({
            data: { name: draft.name, userId: auth.userId },
          });
          workflowId = workflow.id;
        } else {
          await createWorkflowVersion({
            workflowId,
            userId: auth.userId,
            createdByTool: "apply_workflow_draft",
            summary: `Before applying draft ${draft.id}`,
          });
        }

        await prisma.$transaction(async (tx) => {
          await replaceWorkflowGraph({ workflowId: workflowId!, nodes, edges, tx });
          await tx.workflowDraft.update({
            where: { id: draft.id },
            data: {
              workflowId,
              status: "APPLIED",
              appliedAt: new Date(),
              validation: validation as unknown as Prisma.InputJsonValue,
            },
          });
        });

        await saveDraftRevision(draft.id, "apply_workflow_draft");
        audit.success();

        return mcpJsonResponse({
          applied: true,
          workflowId,
          draftId: draft.id,
          diff,
          validation,
        });
      });
    },
  );
}
