/**
 * Widget screenshot evidence.
 *
 * Writes one PNG per widget per theme into docs/mcp/evidence/widgets/, so a
 * reviewer can see what the MCP App UI actually looks like without running a
 * host. Run with:
 *
 *   PLAYWRIGHT_SKIP_WEB_SERVER=true npx playwright test \
 *     --config playwright.config.mjs widget-screenshots --project=chromium
 *
 * Pinned viewport: the images are a before/after comparison surface, so they
 * must differ only by the change under review.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";
import {
  renderChatGptWidgetHtml,
  type ChatGptWidgetKind,
} from "../../../src/mcp/apps/widget-resources";
import { mountWidget, type HostTheme } from "./host-harness";

const OUT_DIR = path.resolve(process.cwd(), "docs/mcp/evidence/widgets");
const WIDTH = 420;

function draftDetails() {
  return {
    draft: {
      id: "draft_demo",
      name: "Summarize new leads",
      goal: "Summarize every new lead and notify the sales team in Slack.",
      status: "DRAFT",
      workflowId: null,
    },
    validation: { valid: true, errors: [], missingFields: [] },
    explanation: {
      beginnerExplanation:
        "When someone submits the lead form, a8n summarizes what they wrote and posts the summary to your Slack channel.",
    },
    nodes: [
      {
        id: "n1",
        type: "GOOGLE_FORM_TRIGGER",
        label: "Google Form trigger",
        description: "Starts when a new lead form is submitted.",
        sideEffect: false,
      },
      {
        id: "n2",
        type: "OPENAI",
        label: "Summarize with OpenAI",
        description: "Turns the answers into a two-line summary.",
        sideEffect: false,
      },
      {
        id: "n3",
        type: "SLACK",
        label: "Send Slack message",
        description: "Posts the summary to #sales.",
        sideEffect: true,
      },
    ],
    edges: [
      { source: "n1", target: "n2" },
      { source: "n2", target: "n3" },
    ],
  };
}

function checklistDetails() {
  return {
    workflow: { id: "wf_demo", name: "Summarize new leads" },
    ready: false,
    validation: {
      valid: false,
      missingFields: [
        { label: "Slack channel", nodeType: "SLACK", reason: "Where the summary is posted." },
      ],
    },
    credentialChecks: [
      {
        nodeId: "n2",
        nodeType: "OPENAI",
        nodeLabel: "Summarize with OpenAI",
        requiredCredentialType: "OPENAI",
        credentialId: "cred_openai",
        status: "configured",
      },
      {
        nodeId: "n3",
        nodeType: "SLACK",
        nodeLabel: "Send Slack message",
        requiredCredentialType: "SLACK",
        credentialId: null,
        status: "missing",
      },
    ],
    webhookSteps: [
      {
        nodeId: "n1",
        nodeType: "GOOGLE_FORM_TRIGGER",
        webhookUrl: "https://a8n.app/api/webhooks/google-form?workflowId=wf_demo",
        verification: "Set GOOGLE_FORM_WEBHOOK_SECRET for shared-secret verification.",
      },
    ],
    testSteps: [
      "Run test_credential for every configured credential.",
      "Run test_webhook_setup for the Google Form trigger.",
      "Run run_workflow_test before sending real leads.",
    ],
  };
}

function timelineDetails() {
  return {
    execution: {
      id: "exec_demo",
      workflowId: "wf_demo",
      workflowName: "Summarize new leads",
      status: "FAILED",
      startedAt: "2026-09-18T09:14:00.000Z",
      completedAt: "2026-09-18T09:14:06.400Z",
      durationMs: 6400,
      error: "Slack API returned 401: invalid_auth",
    },
    timeline: [
      {
        order: 1,
        nodeId: "n1",
        nodeType: "GOOGLE_FORM_TRIGGER",
        label: "Google Form trigger",
        status: "success",
      },
      {
        order: 2,
        nodeId: "n2",
        nodeType: "OPENAI",
        label: "Summarize with OpenAI",
        status: "success",
      },
      {
        order: 3,
        nodeId: "n3",
        nodeType: "SLACK",
        label: "Send Slack message",
        status: "needs_diagnosis",
      },
    ],
    output: {},
  };
}

function approvalDetails() {
  return {
    draft: {
      id: "draft_demo",
      name: "Summarize new leads",
      goal: "Summarize every new lead and notify the sales team.",
      workflowId: "wf_demo",
    },
    validation: { valid: true, errors: [] },
    diff: {
      addedNodes: [{ id: "n3" }],
      changedNodes: [{ id: "n2" }],
      removedNodes: [],
      addedEdges: [{ source: "n2", target: "n3" }],
    },
    approval: {
      required: true,
      confirmationHash: "9f2c41ab7e0d5836",
      tool: "apply_workflow_draft",
      arguments: {
        draftId: "draft_demo",
        workflowId: "wf_demo",
        approved: true,
        confirmationHash: "9f2c41ab7e0d5836",
      },
    },
  };
}

const CASES: Array<{ kind: ChatGptWidgetKind; details: unknown }> = [
  { kind: "workflowDraftPreview", details: draftDetails() },
  { kind: "workflowSetupChecklist", details: checklistDetails() },
  { kind: "executionTimeline", details: timelineDetails() },
  { kind: "workflowApproval", details: approvalDetails() },
];

const THEMES: HostTheme[] = ["light", "dark"];

test.describe("widget screenshots", () => {
  for (const { kind, details } of CASES) {
    for (const theme of THEMES) {
      test(`${kind} — ${theme}`, async ({ page }) => {
        await mountWidget(page, {
          html: await renderChatGptWidgetHtml(kind),
          details,
          structuredContent: { kind },
          theme,
          width: WIDTH,
        });

        const frame = page.locator("#widget-frame");
        // Size the frame to its content so the shot has no dead space.
        const height = await page
          .frameLocator("#widget-frame")
          .locator("body")
          .evaluate((body) => body.scrollHeight);
        await page.evaluate((h) => {
          const el = document.getElementById("widget-frame");
          if (el) el.style.height = `${h}px`;
        }, height);

        await fs.mkdir(OUT_DIR, { recursive: true });
        await frame.screenshot({ path: path.join(OUT_DIR, `${kind}-${theme}.png`) });
      });
    }
  }
});
