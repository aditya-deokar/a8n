/**
 * Seeds the all-nodes showcase workflow for the demo user.
 *
 * Run:
 *   pnpm seed:showcase
 */

import "dotenv/config";
import prisma from "../src/lib/db";
import { encrypt } from "../src/lib/encryption";
import { CredentialType, NodeType, type Credential, type Node } from "../src/generated/prisma";

const USER_EMAIL = "adityadeokar80@gmail.com";
const WORKFLOW_NAME = "All Nodes Demo - AI Operations Command Center";

const PLACEHOLDER_CREDENTIALS = {
  [CredentialType.OPENAI]: {
    name: "Demo OpenAI Credential - replace",
    value: "replace-with-openai-api-key",
  },
  [CredentialType.ANTHROPIC]: {
    name: "Demo Anthropic Credential - replace",
    value: "replace-with-anthropic-api-key",
  },
  [CredentialType.GEMINI]: {
    name: "Demo Gemini Credential - replace",
    value: "replace-with-gemini-api-key",
  },
} as const;

const NODE_IDS = {
  manual: "demo-allnodes-manual-trigger",
  googleForm: "demo-allnodes-google-form-trigger",
  stripe: "demo-allnodes-stripe-trigger",
  enrichment: "demo-allnodes-http-enrichment",
  openai: "demo-allnodes-openai-triage",
  anthropic: "demo-allnodes-anthropic-response",
  gemini: "demo-allnodes-gemini-summary",
  discord: "demo-allnodes-discord-alert",
  slack: "demo-allnodes-slack-alert",
} as const;

const PLACEHOLDER_DISCORD_WEBHOOK = "https://example.com/replace-discord-webhook";
const PLACEHOLDER_SLACK_WEBHOOK = "https://example.com/replace-slack-content-webhook";

type ExistingNodeData = Record<string, unknown>;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getDemoBaseUrl = () =>
  stripTrailingSlash(
    process.env.DEMO_BASE_URL ||
      process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      process.env.NGROK_URL ||
      "http://localhost:3000",
  );

const isRecord = (value: unknown): value is ExistingNodeData =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nodeData = (node?: Node | null): ExistingNodeData =>
  isRecord(node?.data) ? (node.data as ExistingNodeData) : {};

const isPlaceholderWebhook = (value: string, placeholder: string) =>
  !value.trim() || value === placeholder || value.includes("example.com/replace-");

const getExistingNodeData = (
  existingNodesById: Map<string, Node>,
  nodeId: string,
) => nodeData(existingNodesById.get(nodeId));

async function ensurePlaceholderCredential(
  userId: string,
  type: CredentialType,
): Promise<Credential> {
  const placeholder = PLACEHOLDER_CREDENTIALS[type];
  const existing = await prisma.credential.findFirst({
    where: {
      userId,
      type,
      name: placeholder.name,
    },
  });

  if (existing) return existing;

  return prisma.credential.create({
    data: {
      userId,
      type,
      name: placeholder.name,
      value: encrypt(placeholder.value),
    },
  });
}

async function resolveCredentialId({
  userId,
  type,
  existingData,
  placeholderCredential,
}: {
  userId: string;
  type: CredentialType;
  existingData: ExistingNodeData;
  placeholderCredential: Credential;
}) {
  const existingCredentialId =
    typeof existingData.credentialId === "string" ? existingData.credentialId : undefined;

  if (!existingCredentialId) return placeholderCredential.id;

  const existingCredential = await prisma.credential.findFirst({
    where: {
      id: existingCredentialId,
      userId,
      type,
    },
  });

  return existingCredential?.id || placeholderCredential.id;
}

function preserveWebhookUrl(
  existingData: ExistingNodeData,
  placeholderUrl: string,
) {
  const current =
    typeof existingData.webhookUrl === "string" ? existingData.webhookUrl : "";

  return isPlaceholderWebhook(current, placeholderUrl) ? placeholderUrl : current;
}

function edge(source: string, target: string) {
  return {
    fromNodeId: source,
    toNodeId: target,
    fromOutput: "main",
    toInput: "main",
  };
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.error(`No user found for ${USER_EMAIL}. Create/sign in with this account first.`);
    process.exit(1);
  }

  const demoBaseUrl = getDemoBaseUrl();
  const enrichmentEndpoint = `${demoBaseUrl}/api/demo/enrichment`;

  const [openAiCredential, anthropicCredential, geminiCredential] =
    await Promise.all([
      ensurePlaceholderCredential(user.id, CredentialType.OPENAI),
      ensurePlaceholderCredential(user.id, CredentialType.ANTHROPIC),
      ensurePlaceholderCredential(user.id, CredentialType.GEMINI),
    ]);

  const existingWorkflows = await prisma.workflow.findMany({
    where: {
      userId: user.id,
      name: WORKFLOW_NAME,
    },
    include: {
      nodes: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const workflowToKeep = existingWorkflows[0];
  const duplicateWorkflowIds = existingWorkflows.slice(1).map((workflow) => workflow.id);
  const existingNodesById = new Map(
    (workflowToKeep?.nodes || []).map((node) => [node.id, node]),
  );

  const openAiData = getExistingNodeData(existingNodesById, NODE_IDS.openai);
  const anthropicData = getExistingNodeData(existingNodesById, NODE_IDS.anthropic);
  const geminiData = getExistingNodeData(existingNodesById, NODE_IDS.gemini);
  const discordData = getExistingNodeData(existingNodesById, NODE_IDS.discord);
  const slackData = getExistingNodeData(existingNodesById, NODE_IDS.slack);

  const [openAiCredentialId, anthropicCredentialId, geminiCredentialId] =
    await Promise.all([
      resolveCredentialId({
        userId: user.id,
        type: CredentialType.OPENAI,
        existingData: openAiData,
        placeholderCredential: openAiCredential,
      }),
      resolveCredentialId({
        userId: user.id,
        type: CredentialType.ANTHROPIC,
        existingData: anthropicData,
        placeholderCredential: anthropicCredential,
      }),
      resolveCredentialId({
        userId: user.id,
        type: CredentialType.GEMINI,
        existingData: geminiData,
        placeholderCredential: geminiCredential,
      }),
    ]);

  const discordWebhookUrl = preserveWebhookUrl(
    discordData,
    PLACEHOLDER_DISCORD_WEBHOOK,
  );
  const slackWebhookUrl = preserveWebhookUrl(
    slackData,
    PLACEHOLDER_SLACK_WEBHOOK,
  );

  const nodes = [
    {
      id: NODE_IDS.manual,
      name: "Manual Demo Trigger",
      type: NodeType.MANUAL_TRIGGER,
      position: { x: 0, y: 0 },
      data: {},
    },
    {
      id: NODE_IDS.googleForm,
      name: "Google Form Intake Trigger",
      type: NodeType.GOOGLE_FORM_TRIGGER,
      position: { x: 0, y: 180 },
      data: {},
    },
    {
      id: NODE_IDS.stripe,
      name: "Stripe Payment Trigger",
      type: NodeType.STRIPE_TRIGGER,
      position: { x: 0, y: 360 },
      data: {},
    },
    {
      id: NODE_IDS.enrichment,
      name: "Normalize Demo Event",
      type: NodeType.HTTP_REQUEST,
      position: { x: 360, y: 180 },
      data: {
        variableName: "enrichment",
        endpoint: enrichmentEndpoint,
        method: "POST",
        body: "{{json this}}",
      },
    },
    {
      id: NODE_IDS.openai,
      name: "OpenAI Triage",
      type: NodeType.OPENAI,
      position: { x: 720, y: 180 },
      credentialId: openAiCredentialId,
      data: {
        variableName: "openAiTriage",
        credentialId: openAiCredentialId,
        systemPrompt:
          "You are a senior operations triage assistant. Return concise, structured operational guidance.",
        userPrompt:
          "Analyze this normalized event and return Category, Priority, Summary, Recommended next action, and Escalate yes/no.\n\nEvent:\n{{json enrichment.httpResponse.data.demoEvent}}",
      },
    },
    {
      id: NODE_IDS.anthropic,
      name: "Anthropic Customer Response Draft",
      type: NodeType.ANTHROPIC,
      position: { x: 1080, y: 180 },
      credentialId: anthropicCredentialId,
      data: {
        variableName: "anthropicDraft",
        credentialId: anthropicCredentialId,
        systemPrompt:
          "You draft short, empathetic operational responses for support and billing teams.",
        userPrompt:
          "Using the event and OpenAI triage below, draft a short customer/team response with a confident next step.\n\nEvent:\n{{json enrichment.httpResponse.data.demoEvent}}\n\nOpenAI triage:\n{{openAiTriage.text}}",
      },
    },
    {
      id: NODE_IDS.gemini,
      name: "Gemini Executive Summary",
      type: NodeType.GEMINI,
      position: { x: 1440, y: 180 },
      credentialId: geminiCredentialId,
      data: {
        variableName: "geminiSummary",
        credentialId: geminiCredentialId,
        systemPrompt:
          "You create crisp executive summaries for a workflow automation demo.",
        userPrompt:
          "Create a compact final alert from this workflow context. Include source, priority, escalation, and next action.\n\nNormalized event:\n{{json enrichment.httpResponse.data.demoEvent}}\n\nTriage:\n{{openAiTriage.text}}\n\nResponse draft:\n{{anthropicDraft.text}}",
      },
    },
    {
      id: NODE_IDS.discord,
      name: "Discord Support Alert",
      type: NodeType.DISCORD,
      position: { x: 1800, y: 80 },
      data: {
        variableName: "discordAlert",
        webhookUrl: discordWebhookUrl,
        username: "a8n Demo Bot",
        content:
          "A8N Demo Alert\n\nSource: {{enrichment.httpResponse.data.demoEvent.sourceLabel}}\nPriority: {{enrichment.httpResponse.data.demoEvent.priority}}\n\n{{geminiSummary.text}}",
      },
    },
    {
      id: NODE_IDS.slack,
      name: "Slack Operations Alert",
      type: NodeType.SLACK,
      position: { x: 2160, y: 180 },
      data: {
        variableName: "slackAlert",
        webhookUrl: slackWebhookUrl,
        content:
          "A8N Demo Workflow Completed\n\nSource: {{enrichment.httpResponse.data.demoEvent.sourceLabel}}\nCustomer: {{enrichment.httpResponse.data.demoEvent.customerName}}\n\nFinal summary:\n{{geminiSummary.text}}",
      },
    },
  ];

  const connections = [
    edge(NODE_IDS.manual, NODE_IDS.enrichment),
    edge(NODE_IDS.googleForm, NODE_IDS.enrichment),
    edge(NODE_IDS.stripe, NODE_IDS.enrichment),
    edge(NODE_IDS.enrichment, NODE_IDS.openai),
    edge(NODE_IDS.openai, NODE_IDS.anthropic),
    edge(NODE_IDS.anthropic, NODE_IDS.gemini),
    edge(NODE_IDS.gemini, NODE_IDS.discord),
    edge(NODE_IDS.discord, NODE_IDS.slack),
  ];

  const workflow = await prisma.$transaction(async (tx) => {
    if (duplicateWorkflowIds.length > 0) {
      await tx.workflow.deleteMany({
        where: {
          userId: user.id,
          id: { in: duplicateWorkflowIds },
        },
      });
    }

    const currentWorkflow =
      workflowToKeep ||
      (await tx.workflow.create({
        data: {
          userId: user.id,
          name: WORKFLOW_NAME,
        },
      }));

    await tx.node.deleteMany({
      where: {
        workflowId: currentWorkflow.id,
      },
    });

    await tx.node.createMany({
      data: nodes.map((node) => ({
        id: node.id,
        workflowId: currentWorkflow.id,
        name: node.name,
        type: node.type,
        position: node.position,
        credentialId: "credentialId" in node ? node.credentialId : undefined,
        data: node.data,
      })),
    });

    await tx.connection.createMany({
      data: connections.map((connection) => ({
        workflowId: currentWorkflow.id,
        ...connection,
      })),
    });

    return tx.workflow.update({
      where: {
        id: currentWorkflow.id,
      },
      data: {
        name: WORKFLOW_NAME,
        updatedAt: new Date(),
      },
      include: {
        nodes: true,
        connections: true,
      },
    });
  });

  console.log(`Seeded workflow for ${user.name} (${user.email})`);
  console.log(`Workflow: ${workflow.name}`);
  console.log(`Workflow ID: ${workflow.id}`);
  console.log(`Nodes: ${workflow.nodes.length}`);
  console.log(`Connections: ${workflow.connections.length}`);
  console.log("");
  console.log("Webhook URLs:");
  console.log(
    `Google Form: ${demoBaseUrl}/api/webhooks/google-form?workflowId=${workflow.id}`,
  );
  console.log(
    `Stripe:      ${demoBaseUrl}/api/webhooks/stripe?workflowId=${workflow.id}`,
  );
  console.log("");
  console.log("Replace these before a live successful run:");
  console.log(`- ${PLACEHOLDER_CREDENTIALS.OPENAI.name}`);
  console.log(`- ${PLACEHOLDER_CREDENTIALS.ANTHROPIC.name}`);
  console.log(`- ${PLACEHOLDER_CREDENTIALS.GEMINI.name}`);
  console.log("- Discord webhook URL on the Discord Support Alert node");
  console.log("- Slack webhook URL on the Slack Operations Alert node");
}

main()
  .catch((error) => {
    console.error("Failed to seed showcase workflow:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
