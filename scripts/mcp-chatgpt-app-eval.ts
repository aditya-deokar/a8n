import "dotenv/config";
import {
  CHATGPT_APP_TOOL_POLICY,
  CHATGPT_FORBIDDEN_TOOLS,
  type McpToolRisk,
} from "../src/mcp/safety/app-tool-policy";
import { CHATGPT_WIDGET_URIS } from "../src/mcp/apps/widget-resources";
import { detectPromptInjectionWarnings } from "../src/mcp/shared/safety";
import { CHATGPT_APP_EVALS } from "../src/mcp/evals/chatgpt-app-goals";

type CaseResult = {
  id: string;
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  tools: string[];
  widgets: string[];
};

type Check = {
  name: string;
  ok: boolean;
  detail?: unknown;
};

const REQUIRED_RISK_COVERAGE: McpToolRisk[] = [
  "read_only",
  "draft_write",
  "approval_gated_write",
  "external_side_effect",
  "repair_write",
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
  };
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function check(name: string, ok: boolean, detail?: unknown): Check {
  return { name, ok, detail };
}

function evaluateCase(testCase: (typeof CHATGPT_APP_EVALS)[number]): CaseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const knownWidgets = new Set<string>(Object.values(CHATGPT_WIDGET_URIS));
  const forbidden = new Set<string>(CHATGPT_FORBIDDEN_TOOLS);

  if (!testCase.prompt.includes("@a8n")) {
    warnings.push("Prompt does not include explicit @a8n invocation.");
  }

  for (const toolName of testCase.expected.tools) {
    const policy = CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY];
    if (!policy) {
      errors.push(`Expected tool is not in ChatGPT policy: ${toolName}`);
      continue;
    }
    if (!policy.chatGptMvp) {
      errors.push(`Expected tool is not visible in ChatGPT MVP: ${toolName}`);
    }
    if (forbidden.has(toolName)) {
      errors.push(`Expected tool is forbidden in ChatGPT profile: ${toolName}`);
    }
  }

  for (const widgetUri of testCase.expected.widgets) {
    if (!knownWidgets.has(widgetUri)) {
      errors.push(`Unknown widget URI: ${widgetUri}`);
    }
  }

  for (const approvalTool of testCase.expected.approvalTools) {
    const policy = CHATGPT_APP_TOOL_POLICY[approvalTool as keyof typeof CHATGPT_APP_TOOL_POLICY];
    if (!testCase.expected.tools.includes(approvalTool)) {
      errors.push(`Approval tool is not listed as an expected tool: ${approvalTool}`);
    }
    if (!policy?.requiresApproval) {
      errors.push(`Approval tool is not marked requiresApproval: ${approvalTool}`);
    }
  }

  for (const toolName of testCase.expected.tools) {
    const policy = CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY];
    if (policy?.requiresApproval && !testCase.expected.approvalTools.includes(toolName)) {
      errors.push(`Approval-gated tool is missing from approvalTools: ${toolName}`);
    }
  }

  for (const forbiddenTool of testCase.expected.forbiddenTools) {
    if (testCase.expected.tools.includes(forbiddenTool)) {
      errors.push(`Forbidden tool also appears in expected tools: ${forbiddenTool}`);
    }
  }

  if (testCase.expected.safetyPatterns.length > 0) {
    const warningsFound = detectPromptInjectionWarnings(testCase.adversarialToolOutput);
    const patternsFound = new Set(warningsFound.map((warning) => warning.pattern));
    for (const pattern of testCase.expected.safetyPatterns) {
      if (!patternsFound.has(pattern)) {
        errors.push(`Missing expected safety pattern: ${pattern}`);
      }
    }
  }

  const checks = 7;
  const score = Number(((checks - errors.length) / checks).toFixed(3));

  return {
    id: testCase.id,
    passed: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    tools: testCase.expected.tools,
    widgets: testCase.expected.widgets,
  };
}

function suiteChecks(results: CaseResult[]): Check[] {
  const allExpectedTools = uniq(CHATGPT_APP_EVALS.flatMap((item) => item.expected.tools));
  const allWidgets = uniq(CHATGPT_APP_EVALS.flatMap((item) => item.expected.widgets));
  const allRiskLevels: McpToolRisk[] = uniq(
    allExpectedTools.flatMap((toolName) => {
      const risk = CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY]?.risk;
      return risk ? [risk as McpToolRisk] : [];
    }),
  );
  const expectedForbiddenTools = uniq(
    CHATGPT_APP_EVALS.flatMap((item) => item.expected.forbiddenTools),
  );
  const policyToolNames = Object.keys(CHATGPT_APP_TOOL_POLICY);

  return [
    check("at least 8 app-facing eval cases", CHATGPT_APP_EVALS.length >= 8, {
      count: CHATGPT_APP_EVALS.length,
    }),
    check("eval case ids are unique", new Set(CHATGPT_APP_EVALS.map((item) => item.id)).size === CHATGPT_APP_EVALS.length),
    check(
      "all ChatGPT policy tools are covered by policy",
      policyToolNames.every((toolName) => CHATGPT_APP_TOOL_POLICY[toolName as keyof typeof CHATGPT_APP_TOOL_POLICY].chatGptMvp),
      { policyToolCount: policyToolNames.length },
    ),
    check(
      "required risk levels covered",
      REQUIRED_RISK_COVERAGE.every((risk) => allRiskLevels.includes(risk)),
      { required: REQUIRED_RISK_COVERAGE, covered: allRiskLevels },
    ),
    check(
      "all widget resources covered",
      Object.values(CHATGPT_WIDGET_URIS).every((uri) => allWidgets.includes(uri)),
      { required: Object.values(CHATGPT_WIDGET_URIS), covered: allWidgets },
    ),
    check(
      "forbidden tools are treated as forbidden in evals",
      expectedForbiddenTools.every((toolName) => CHATGPT_FORBIDDEN_TOOLS.includes(toolName as (typeof CHATGPT_FORBIDDEN_TOOLS)[number]) || toolName in CHATGPT_APP_TOOL_POLICY),
      { expectedForbiddenTools },
    ),
    check("all eval cases pass", results.every((result) => result.passed), {
      failures: results.filter((result) => !result.passed).map((result) => result.id),
    }),
  ];
}

function main() {
  const options = parseArgs();
  const results = CHATGPT_APP_EVALS.map(evaluateCase);
  const checks = suiteChecks(results);
  const passedCount = results.filter((result) => result.passed).length;
  const averageScore =
    results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1);
  const passed = checks.every((item) => item.ok);
  const report = {
    suite: "chatgpt-app-workflow-assistant",
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    passedCount,
    passRate: Number((passedCount / Math.max(results.length, 1)).toFixed(3)),
    averageScore: Number(averageScore.toFixed(3)),
    passed,
    checks,
    failures: results.filter((result) => !result.passed),
    results,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT app eval suite");
    console.log(`Cases: ${passedCount}/${results.length} passed`);
    console.log(`Average score: ${report.averageScore}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"}`);
    }
    for (const failure of report.failures) {
      console.log(`- ${failure.id}: ${failure.errors.join("; ")}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
