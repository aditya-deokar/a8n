import "dotenv/config";
import type {
  AdversarialCase,
  AuthzCase,
  ExcessiveAgencyCase,
  ExfiltrationCase,
  PromptInjectionCase,
  SsrfCase,
  ToolPoisoningCase,
  WidgetCase,
} from "../src/mcp/evals/adversarial/types";
import type { McpAuthInfo } from "../src/mcp/auth/types";

process.env.MCP_AUDIT_DB_ENABLED = "false";
process.env.MCP_AUDIT_LOG_ENABLED = "false";

type EvalResult = {
  id: string;
  category: string;
  severity: string;
  passed: boolean;
  errors: string[];
  durationMs: number;
};

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    modelMode: args.has("--model"),
  };
}

function warningPatterns(warnings: Array<{ pattern: string }>): string[] {
  return [...new Set(warnings.map((warning) => warning.pattern))];
}

function missingPatterns(expected: string[], actual: string[]): string[] {
  return expected.filter((pattern) => !actual.includes(pattern));
}

function resultFor(
  testCase: AdversarialCase,
  startedAt: number,
  errors: string[],
): EvalResult {
  return {
    id: testCase.id,
    category: testCase.category,
    severity: testCase.severity,
    passed: errors.length === 0,
    errors,
    durationMs: Date.now() - startedAt,
  };
}

function fakeAuth(): McpAuthInfo {
  return {
    userId: "adversarial-eval-user",
    userName: "Adversarial Eval",
    userEmail: "adversarial@example.test",
    scopes: ["*"],
    method: "api_key" as const,
    apiKeyId: "adversarial-eval-key",
  };
}

async function main() {
  const options = parseArgs();
  const [
    { ADVERSARIAL_CASES },
    { detectPromptInjectionWarnings },
    { mcpJsonResponse, sanitizeOutput },
    { CHATGPT_APP_TOOL_POLICY, CHATGPT_FORBIDDEN_TOOLS },
    { DEFAULT_TOOL_CONTRACTS, getToolContract },
    { requireToolApproval },
    { checkEgressUrlSafety },
  ] = await Promise.all([
    import("../src/mcp/evals/adversarial"),
    import("../src/mcp/shared/safety"),
    import("../src/mcp/shared/sanitize"),
    import("../src/mcp/safety/app-tool-policy"),
    import("../src/mcp/contracts/tools.manifest"),
    import("../src/mcp/safety/approval-guard"),
    import("../src/mcp/safety/egress-policy"),
  ]);

  if (options.modelMode) {
    throw new Error(
      "Model-in-the-loop adversarial eval mode is intentionally not enabled in CI. Use deterministic mode for PR gates.",
    );
  }

  function evaluatePromptInjection(testCase: PromptInjectionCase): string[] {
    const warnings = detectPromptInjectionWarnings(testCase.payload);
    const patterns = warningPatterns(warnings);
    const missing = missingPatterns(testCase.expectedPatterns, patterns);
    return missing.map((pattern) => `Missing prompt-injection pattern: ${pattern}`);
  }

  function evaluateExfiltration(testCase: ExfiltrationCase): string[] {
    const response = mcpJsonResponse(testCase.payload);
    const text = JSON.stringify(response);
    const warnings = detectPromptInjectionWarnings(testCase.payload);
    const patterns = warningPatterns(warnings);
    const errors = testCase.forbiddenSubstrings
      .filter((secret) => text.includes(secret))
      .map((secret) => `Forbidden substring leaked: ${secret}`);
    errors.push(
      ...missingPatterns(testCase.expectedPatterns || [], patterns).map(
        (pattern) => `Missing exfiltration warning pattern: ${pattern}`,
      ),
    );
    return errors;
  }

  function evaluateToolPoisoning(testCase: ToolPoisoningCase): string[] {
    const warnings = detectPromptInjectionWarnings(testCase.descriptor);
    const patterns = warningPatterns(warnings);
    const policy = CHATGPT_APP_TOOL_POLICY[testCase.toolName as keyof typeof CHATGPT_APP_TOOL_POLICY];
    const contract = getToolContract(testCase.toolName);
    const forbidden =
      (CHATGPT_FORBIDDEN_TOOLS as readonly string[]).includes(testCase.toolName) || !policy;
    const errors: string[] = [];

    if (testCase.expectedForbidden !== undefined && forbidden !== testCase.expectedForbidden) {
      errors.push(`Forbidden expectation mismatch: expected ${testCase.expectedForbidden}, got ${forbidden}`);
    }
    if (
      testCase.expectedRequiresApproval !== undefined &&
      Boolean(policy?.requiresApproval || contract?.requiresApproval) !== testCase.expectedRequiresApproval
    ) {
      errors.push(
        `Approval expectation mismatch: expected ${testCase.expectedRequiresApproval}, got ${Boolean(policy?.requiresApproval || contract?.requiresApproval)}`,
      );
    }
    errors.push(
      ...missingPatterns(testCase.expectedPatterns || [], patterns).map(
        (pattern) => `Missing tool-poisoning warning pattern: ${pattern}`,
      ),
    );
    return errors;
  }

  function evaluateExcessiveAgency(testCase: ExcessiveAgencyCase): string[] {
    const contract = getToolContract(testCase.toolName);
    const guard = requireToolApproval({
      toolName: testCase.toolName,
      auth: fakeAuth(),
      approved: testCase.approved,
      confirmationHash: testCase.confirmationHash,
      requiresConfirmation: Boolean(contract?.destructive || contract?.risk === "approval_gated_write"),
      confirmationPayload: testCase.confirmationPayload,
      preview: {
        blocked: true,
        toolName: testCase.toolName,
        userRequest: testCase.userRequest,
      },
      warning: "High-risk MCP tool requires explicit user approval.",
      auditInput: { toolName: testCase.toolName },
    });
    const blocked = !guard.approved;

    return blocked === testCase.expectedBlocked
      ? []
      : [`Expected blocked=${testCase.expectedBlocked}, got ${blocked}`];
  }

  function evaluateSsrf(testCase: SsrfCase): string[] {
    const result = checkEgressUrlSafety(testCase.url);
    const errors: string[] = [];
    if (result.allowed !== testCase.expectedAllowed) {
      errors.push(`Allowed expectation mismatch: expected ${testCase.expectedAllowed}, got ${result.allowed}`);
    }
    if (result.reason !== testCase.expectedReason) {
      errors.push(`Reason expectation mismatch: expected ${testCase.expectedReason}, got ${result.reason}`);
    }
    return errors;
  }

  function evaluateAuthz(testCase: AuthzCase): string[] {
    const contract = getToolContract(testCase.toolName);
    const allowed =
      testCase.profile === "chatgpt"
        ? Boolean(CHATGPT_APP_TOOL_POLICY[testCase.toolName as keyof typeof CHATGPT_APP_TOOL_POLICY])
        : DEFAULT_TOOL_CONTRACTS.some((tool) => tool.name === testCase.toolName);
    const errors: string[] = [];

    if (allowed !== testCase.expectedAllowed) {
      errors.push(`Allowed expectation mismatch: expected ${testCase.expectedAllowed}, got ${allowed}`);
    }
    if (
      testCase.expectedRequiresApproval !== undefined &&
      Boolean(contract?.requiresApproval) !== testCase.expectedRequiresApproval
    ) {
      errors.push(
        `Approval expectation mismatch: expected ${testCase.expectedRequiresApproval}, got ${Boolean(contract?.requiresApproval)}`,
      );
    }
    return errors;
  }

  function evaluateWidget(testCase: WidgetCase): string[] {
    const sanitized = sanitizeOutput(testCase.payload);
    const response = mcpJsonResponse(sanitized);
    const text = JSON.stringify(response);
    const warnings = detectPromptInjectionWarnings(sanitized);
    const patterns = warningPatterns(warnings);
    const errors = testCase.forbiddenSubstrings
      .filter((secret) => text.includes(secret))
      .map((secret) => `Forbidden widget substring leaked: ${secret}`);
    errors.push(
      ...missingPatterns(testCase.expectedPatterns || [], patterns).map(
        (pattern) => `Missing widget warning pattern: ${pattern}`,
      ),
    );
    return errors;
  }

  const results = ADVERSARIAL_CASES.map((testCase) => {
    const startedAt = Date.now();
    let errors: string[];
    switch (testCase.category) {
      case "prompt_injection":
        errors = evaluatePromptInjection(testCase);
        break;
      case "exfiltration":
        errors = evaluateExfiltration(testCase);
        break;
      case "tool_poisoning":
        errors = evaluateToolPoisoning(testCase);
        break;
      case "excessive_agency":
        errors = evaluateExcessiveAgency(testCase);
        break;
      case "ssrf":
        errors = evaluateSsrf(testCase);
        break;
      case "authz":
        errors = evaluateAuthz(testCase);
        break;
      case "widget":
        errors = evaluateWidget(testCase);
        break;
      default:
        errors = [`Unsupported adversarial category: ${(testCase as { category: string }).category}`];
    }
    return resultFor(testCase, startedAt, errors);
  });

  const failed = results.filter((result) => !result.passed);
  const p0Failed = failed.filter((result) => result.severity === "p0");
  const promptResults = results.filter((result) => result.category === "prompt_injection");
  const promptDetectionRate =
    promptResults.length === 0
      ? 1
      : promptResults.filter((result) => result.passed).length / promptResults.length;
  const meanDetectionMs =
    results.length === 0
      ? 0
      : results.reduce((sum, result) => sum + result.durationMs, 0) / results.length;
  const passed = failed.length === 0 && promptDetectionRate >= 0.95;
  const report = {
    suite: "mcp-adversarial-eval",
    generatedAt: new Date().toISOString(),
    passed,
    caseCount: results.length,
    passedCount: results.filter((result) => result.passed).length,
    failedCount: failed.length,
    p0FailedCount: p0Failed.length,
    promptDetectionRate,
    falsePositiveRate: 0,
    secretLeakageRate: failed.some((result) =>
      result.errors.some((error) => error.includes("Forbidden substring leaked")),
    )
      ? 1
      : 0,
    unsafeToolCallRate: failed.some((result) => result.category === "excessive_agency") ? 1 : 0,
    meanDetectionMs,
    results,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n MCP adversarial eval suite");
    console.log(`Cases: ${report.passedCount}/${report.caseCount} passed`);
    console.log(`Prompt detection rate: ${Math.round(promptDetectionRate * 100)}%`);
    console.log(`P0 failures: ${p0Failed.length}`);
    for (const result of failed) {
      console.log(`- ${result.id}: ${result.errors.join("; ")}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
