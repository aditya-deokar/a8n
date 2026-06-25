import "dotenv/config";
import { CredentialType, NodeType } from "../src/generated/prisma";
import {
  CREDENTIAL_TYPE_MANIFESTS,
  NODE_MANIFESTS,
  WORKFLOW_TEMPLATE_MANIFESTS,
  getNodeManifest,
} from "../src/features/workflows/node-manifest";
import { NON_TECHNICAL_GOAL_EVALS } from "../src/mcp/evals/non-technical-goals";
import { sanitizeOutput } from "../src/mcp/shared/sanitize";

type GoalPrediction = {
  nodeTypes: NodeType[];
  credentialTypes: CredentialType[];
  integrations: string[];
  trigger: NodeType;
  externalSideEffects: NodeType[];
  clarificationQuestions: string[];
};

type CaseResult = {
  id: string;
  passed: boolean;
  score: number;
  missingNodes: string[];
  missingCredentials: string[];
  missingIntegrations: string[];
  missingSideEffects: string[];
  triggerMatched: boolean;
  questionCoverage: number;
  predicted: GoalPrediction;
};

const NODE_TO_INTEGRATION: Partial<Record<NodeType, string>> = {
  [NodeType.GOOGLE_FORM_TRIGGER]: "google_form",
  [NodeType.STRIPE_TRIGGER]: "stripe",
  [NodeType.HTTP_REQUEST]: "http",
  [NodeType.OPENAI]: "openai",
  [NodeType.ANTHROPIC]: "anthropic",
  [NodeType.GEMINI]: "gemini",
  [NodeType.SLACK]: "slack",
  [NodeType.DISCORD]: "discord",
  [NodeType.EMAIL]: "email",
  [NodeType.GOOGLE_SHEETS]: "google_sheets",
};

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function inferNodes(goal: string): NodeType[] {
  const text = goal.toLowerCase();
  const nodes: NodeType[] = [];

  if (
    includesAny(text, [
      "google form",
      "form response",
      "form is submitted",
      "form submission",
      "submits a form",
      "form arrives",
      "fills out",
      "fills my",
      "survey response",
      "lead form",
    ])
  ) {
    nodes.push(NodeType.GOOGLE_FORM_TRIGGER);
  } else if (includesAny(text, ["stripe", "payment", "checkout", "invoice", "refund", "subscription", "dispute"])) {
    nodes.push(NodeType.STRIPE_TRIGGER);
  } else {
    nodes.push(NodeType.MANUAL_TRIGGER);
  }

  if (includesAny(text, ["api", "web request", "fetch", "crm", "fulfillment", "helpdesk", "shipping", "enrichment", "order api", "external"])) {
    nodes.push(NodeType.HTTP_REQUEST);
  }

  if (includesAny(text, ["claude", "anthropic"])) {
    nodes.push(NodeType.ANTHROPIC);
  } else if (includesAny(text, ["gemini", "google ai"])) {
    nodes.push(NodeType.GEMINI);
  } else if (includesAny(text, ["openai", "chatgpt", "gpt"])) {
    nodes.push(NodeType.OPENAI);
  } else if (includesAny(text, [" ai ", "ask ai", "with ai", "have ai", "summarize", "classify", "rewrite", "draft", "generate"])) {
    nodes.push(NodeType.OPENAI);
  }

  if (includesAny(text, ["slack"])) nodes.push(NodeType.SLACK);
  if (includesAny(text, ["discord"])) nodes.push(NodeType.DISCORD);
  if (includesAny(text, ["email", "mail", "inbox", "receipt", "parent", "student", "investor", "customer"])) {
    nodes.push(NodeType.EMAIL);
  }
  if (includesAny(text, ["google sheets", "spreadsheet", "sheet", "append", "log it", "record", "save it", "store", "save a row"])) {
    nodes.push(NodeType.GOOGLE_SHEETS);
  }

  return uniq(nodes);
}

function questionsFor(nodes: NodeType[]): string[] {
  const questions: string[] = [];
  const aiNodeTypes = new Set<NodeType>([NodeType.OPENAI, NodeType.ANTHROPIC, NodeType.GEMINI]);
  if (nodes.includes(NodeType.GOOGLE_FORM_TRIGGER)) {
    questions.push("Which Google Form should start the workflow, and is email collection enabled?");
    questions.push("Do you want a generated Apps Script and a sample form submission test?");
  }
  if (nodes.includes(NodeType.STRIPE_TRIGGER)) {
    questions.push("Which Stripe event should start the workflow?");
    questions.push("Is the Stripe webhook signing secret configured?");
  }
  if (nodes.includes(NodeType.HTTP_REQUEST)) {
    questions.push("What API endpoint and HTTP method should be used?");
    questions.push("Does the API request need a JSON body or headers?");
  }
  if (nodes.some((node) => aiNodeTypes.has(node))) {
    questions.push("What prompt, source text, notes, labels, tone, or summary style should the AI use?");
  }
  if (nodes.includes(NodeType.SLACK)) {
    questions.push("What Slack webhook URL and message should be used?");
  }
  if (nodes.includes(NodeType.DISCORD)) {
    questions.push("What Discord webhook URL and message should be used?");
  }
  if (nodes.includes(NodeType.EMAIL)) {
    questions.push("Who is the email recipient, and what subject and body should be sent?");
  }
  if (nodes.includes(NodeType.GOOGLE_SHEETS)) {
    questions.push("Which spreadsheet, sheet name, and row values should be saved?");
  }

  return questions;
}

function inferGoal(goal: string): GoalPrediction {
  const nodeTypes = inferNodes(goal);
  const triggerNodeTypes = new Set<NodeType>([
    NodeType.MANUAL_TRIGGER,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
  ]);
  const credentialTypes = uniq(
    nodeTypes
      .map((nodeType) => getNodeManifest(nodeType).credentialType)
      .filter((credentialType): credentialType is CredentialType => Boolean(credentialType)),
  );
  const integrations = uniq(
    nodeTypes
      .map((nodeType) => NODE_TO_INTEGRATION[nodeType])
      .filter((integration): integration is string => Boolean(integration)),
  );
  const trigger =
    nodeTypes.find((nodeType) => triggerNodeTypes.has(nodeType)) || NodeType.MANUAL_TRIGGER;
  const externalSideEffects = nodeTypes.filter((nodeType) => getNodeManifest(nodeType).sideEffect);

  return {
    nodeTypes,
    credentialTypes,
    integrations,
    trigger,
    externalSideEffects,
    clarificationQuestions: questionsFor(nodeTypes),
  };
}

function missing<T>(expected: T[], actual: T[]): T[] {
  const actualSet = new Set(actual);
  return expected.filter((item) => !actualSet.has(item));
}

function topicCovered(topic: string, questions: string[]): boolean {
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const questionText = questions.join(" ").toLowerCase();
  return words.some((word) => questionText.includes(word));
}

function evaluateCase(testCase: (typeof NON_TECHNICAL_GOAL_EVALS)[number]): CaseResult {
  const predicted = inferGoal(testCase.goal);
  const missingNodes = missing(testCase.expected.nodeTypes, predicted.nodeTypes).map(String);
  const missingCredentials = missing(testCase.expected.credentialTypes, predicted.credentialTypes).map(String);
  const missingIntegrations = missing(testCase.expected.integrations, predicted.integrations);
  const missingSideEffects = missing(testCase.expected.externalSideEffects, predicted.externalSideEffects).map(String);
  const coveredQuestions = testCase.expected.mustAskAbout.filter((topic) =>
    topicCovered(topic, predicted.clarificationQuestions),
  );
  const questionCoverage =
    testCase.expected.mustAskAbout.length === 0
      ? 1
      : coveredQuestions.length / testCase.expected.mustAskAbout.length;
  const triggerMatched = predicted.trigger === testCase.expected.trigger;
  const hardPass =
    missingNodes.length === 0 &&
    missingCredentials.length === 0 &&
    missingIntegrations.length === 0 &&
    missingSideEffects.length === 0 &&
    triggerMatched;
  const score =
    (missingNodes.length === 0 ? 0.35 : 0) +
    (missingCredentials.length === 0 ? 0.15 : 0) +
    (missingIntegrations.length === 0 ? 0.15 : 0) +
    (missingSideEffects.length === 0 ? 0.15 : 0) +
    (triggerMatched ? 0.1 : 0) +
    questionCoverage * 0.1;

  return {
    id: testCase.id,
    passed: hardPass && questionCoverage >= 0.5,
    score: Number(score.toFixed(3)),
    missingNodes,
    missingCredentials,
    missingIntegrations,
    missingSideEffects,
    triggerMatched,
    questionCoverage: Number(questionCoverage.toFixed(3)),
    predicted,
  };
}

function validateCatalog() {
  const errors: string[] = [];

  for (const manifest of NODE_MANIFESTS) {
    if (!manifest.label || !manifest.beginnerDescription) {
      errors.push(`${manifest.type} needs label and beginner description.`);
    }
    if (manifest.type !== NodeType.INITIAL && manifest.aliases.length === 0) {
      errors.push(`${manifest.type} needs aliases for search/evals.`);
    }
    if (manifest.sideEffect && manifest.riskLevel === "low") {
      errors.push(`${manifest.type} has side effects but low risk.`);
    }
    if (manifest.credentialType) {
      const credentialManifest = CREDENTIAL_TYPE_MANIFESTS.find(
        (credential) => credential.type === manifest.credentialType,
      );
      if (!credentialManifest?.usedBy.includes(manifest.type)) {
        errors.push(`${manifest.type} credential manifest is not bidirectionally linked.`);
      }
    }
  }

  for (const template of WORKFLOW_TEMPLATE_MANIFESTS) {
    for (const nodeType of template.nodeTypes) {
      if (!NODE_MANIFESTS.some((manifest) => manifest.type === nodeType)) {
        errors.push(`${template.id} references unknown node ${nodeType}.`);
      }
    }
    for (const credentialType of template.requiredCredentialTypes) {
      if (!CREDENTIAL_TYPE_MANIFESTS.some((manifest) => manifest.type === credentialType)) {
        errors.push(`${template.id} references unknown credential ${credentialType}.`);
      }
    }
  }

  return errors;
}

function validateRedaction() {
  const output = sanitizeOutput({
    apiKey: "sk-test-secret-123456789012",
    Authorization: "Bearer super-secret-token-1234567890",
    nested: {
      private_key: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
    },
  });
  const serialized = JSON.stringify(output);
  return !serialized.includes("sk-test-secret") &&
    !serialized.includes("super-secret-token") &&
    !serialized.includes("BEGIN PRIVATE KEY");
}

const results = NON_TECHNICAL_GOAL_EVALS.map(evaluateCase);
const passedCount = results.filter((result) => result.passed).length;
const passRate = passedCount / results.length;
const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
const catalogErrors = validateCatalog();
const redactionPassed = validateRedaction();

const report = {
  suite: "mcp-non-technical-workflow-builder",
  generatedAt: new Date().toISOString(),
  totalCases: results.length,
  passedCount,
  passRate: Number(passRate.toFixed(3)),
  averageScore: Number(averageScore.toFixed(3)),
  gates: {
    minimumCases: results.length >= 50,
    passRateAtLeast80Percent: passRate >= 0.8,
    catalogValid: catalogErrors.length === 0,
    redactionPassed,
  },
  failures: results.filter((result) => !result.passed),
  catalogErrors,
};

const jsonMode = process.argv.includes("--json");
if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("MCP non-technical workflow evaluation");
  console.log(`Cases: ${passedCount}/${results.length} passed (${Math.round(passRate * 100)}%)`);
  console.log(`Average score: ${report.averageScore}`);
  console.log(`Catalog: ${catalogErrors.length === 0 ? "ok" : `${catalogErrors.length} issue(s)`}`);
  console.log(`Redaction: ${redactionPassed ? "ok" : "failed"}`);
  for (const failure of report.failures.slice(0, 10)) {
    console.log(`- ${failure.id}: missing nodes=${failure.missingNodes.join(",") || "none"} missing integrations=${failure.missingIntegrations.join(",") || "none"} questionCoverage=${failure.questionCoverage}`);
  }
}

const gatesPassed = Object.values(report.gates).every(Boolean);
if (!gatesPassed) {
  process.exitCode = 1;
}
