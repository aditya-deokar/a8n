import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const DIST_DIR = path.resolve(PROJECT_ROOT, "dist/mcp-apps");
const ARTIFACT_DIR = "C:\\Users\\adity\\.gemini\\antigravity-ide\\brain\\a77f65ce-2a3d-4461-a947-ff648156188e";

const WIDGET_DATA = [
  {
    name: "workflow-draft-preview",
    outName: "widget-draft-preview.png",
    details: {
      draft: {
        id: "draft_101",
        name: "Google Form -> OpenAI Summarizer -> Slack & Sheets",
        goal: "Summarize customer feedback from Google Forms and broadcast to team",
        status: "READY",
      },
      validation: {
        valid: true,
        errors: [],
      },
      explanation: {
        beginnerExplanation:
          "This workflow automatically receives new Google Form submissions, generates an AI summary using OpenAI GPT-4o, posts the digest to #customer-feedback in Slack, and logs the response row in Google Sheets.",
      },
      nodes: [
        { id: "n1", type: "googleFormsTrigger", label: "Google Form Response", description: "Triggers on form submission" },
        { id: "n2", type: "openAiSummarizer", label: "Summarize Response", description: "Generates 2-sentence summary with GPT-4o" },
        { id: "n3", type: "slackBot", label: "Post to #customer-feedback", description: "Sends summary message to Slack channel" },
        { id: "n4", type: "googleSheets", label: "Append Row to Sheets", description: "Logs full response to Google Sheet" },
      ],
    },
  },
  {
    name: "workflow-setup-checklist",
    outName: "widget-setup-checklist.png",
    details: {
      workflow: {
        id: "wf_202",
        name: "Google Form -> OpenAI Summarizer -> Slack & Sheets",
      },
      ready: false,
      validation: {
        valid: false,
        missingFields: [
          { label: "Slack Channel ID", nodeType: "slackBot" },
        ],
      },
      credentialChecks: [
        { nodeId: "n1", nodeType: "googleFormsTrigger", nodeLabel: "Google Form Response", requiredCredentialType: "googleOAuth", credentialId: "cred_g1", status: "configured" },
        { nodeId: "n2", nodeType: "openAiSummarizer", nodeLabel: "Summarize Response", requiredCredentialType: "openAiApiKey", credentialId: "cred_o1", status: "configured" },
        { nodeId: "n3", nodeType: "slackBot", nodeLabel: "Post to #customer-feedback", requiredCredentialType: "slackOAuth", credentialId: null, status: "missing" },
      ],
      webhookSteps: [
        { nodeId: "n1", nodeType: "googleFormsTrigger", webhookUrl: "https://a8n.io/api/v1/webhooks/wh_google_forms_99812", verification: "verified" },
      ],
      testSteps: [
        "1. Verify Google OAuth token for Google Forms & Sheets.",
        "2. Connect Slack OAuth credential for #customer-feedback.",
        "3. Trigger a test run with sample Google Form data.",
      ],
    },
  },
  {
    name: "execution-timeline",
    outName: "widget-execution-timeline.png",
    details: {
      execution: {
        id: "exec_303",
        workflowId: "wf_202",
        workflowName: "Google Form -> OpenAI Summarizer -> Slack & Sheets",
        status: "SUCCESS",
        durationMs: 412,
      },
      timeline: [
        { order: 1, nodeId: "n1", nodeType: "googleFormsTrigger", label: "Google Form Response", status: "success" },
        { order: 2, nodeId: "n2", nodeType: "openAiSummarizer", label: "Summarize Response", status: "success" },
        { order: 3, nodeId: "n3", nodeType: "slackBot", label: "Post to #customer-feedback", status: "success" },
        { order: 4, nodeId: "n4", nodeType: "googleSheets", label: "Append Row to Sheets", status: "success" },
      ],
    },
  },
  {
    name: "workflow-approval",
    outName: "widget-workflow-approval.png",
    details: {
      draft: {
        id: "draft_101",
        name: "Google Form -> OpenAI Summarizer -> Slack & Sheets",
        workflowId: "wf_202",
      },
      validation: {
        valid: true,
      },
      diff: {
        addedNodes: [{ id: "n4", label: "Append Row to Sheets" }],
        changedNodes: [{ id: "n2", label: "Summarize Response" }],
        removedNodes: [],
        addedEdges: [{ from: "n3", to: "n4" }],
      },
      approval: {
        required: true,
        confirmationHash: "a8n_hash_9f8e7d6c5b4a3210",
        tool: "apply_workflow_draft",
        arguments: {
          draftId: "draft_101",
          workflowId: "wf_202",
          approved: true,
          confirmationHash: "a8n_hash_9f8e7d6c5b4a3210",
        },
      },
    },
  },
];

async function capture() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const item of WIDGET_DATA) {
    const context = await browser.newContext({ viewport: { width: 560, height: 420 } });
    const page = await context.newPage();

    const htmlPath = path.resolve(DIST_DIR, `${item.name}.html`);
    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;

    await page.goto(fileUrl);

    // Send ext-apps JSON-RPC notification for tool result to trigger widget render
    await page.evaluate((detailsData) => {
      window.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            structuredContent: { kind: "test" },
            _meta: { details: detailsData },
          },
        },
        "*",
      );
    }, item.details);

    await page.waitForTimeout(300);

    const screenshotPath = path.resolve(ARTIFACT_DIR, item.outName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Captured: ${item.outName} -> ${screenshotPath}`);
    await context.close();
  }

  await browser.close();
  console.log("✅ All screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("❌ Screenshot capture failed:", err);
  process.exit(1);
});
