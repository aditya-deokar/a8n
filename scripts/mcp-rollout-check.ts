import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { CHATGPT_APP_EVALS } from "../src/mcp/evals/chatgpt-app-goals";

type Check = {
  name: string;
  ok: boolean;
  detail?: unknown;
};

type Incident = {
  file: string;
  metadata: Record<string, string>;
};

const INCIDENT_DIR = path.join(
  process.cwd(),
  "docs",
  "mcp",
  "mcp-apps",
  "rollout",
  "incidents",
);

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    json: args.has("--json"),
    allowOpenCritical: args.has("--allow-open-critical"),
  };
}

function check(name: string, ok: boolean, detail?: unknown): Check {
  return { name, ok, detail };
}

function readIncidents(): Incident[] {
  if (!fs.existsSync(INCIDENT_DIR)) return [];

  return fs
    .readdirSync(INCIDENT_DIR)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => {
      const file = path.join(INCIDENT_DIR, name);
      const content = fs.readFileSync(file, "utf8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const metadata: Record<string, string> = {};

      if (match) {
        for (const line of match[1].split(/\r?\n/)) {
          const separator = line.indexOf(":");
          if (separator === -1) continue;
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
          metadata[key] = value;
        }
      }

      return {
        file,
        metadata,
      };
    });
}

function fileExists(...parts: string[]): boolean {
  return fs.existsSync(path.join(process.cwd(), ...parts));
}

function main() {
  const options = parseArgs();
  const incidents = readIncidents();
  const knownEvalIds = new Set(CHATGPT_APP_EVALS.map((item) => item.id));
  const missingMetadata = incidents.filter(
    (incident) =>
      !incident.metadata.id ||
      !incident.metadata.status ||
      !incident.metadata.severity,
  );
  const closedWithoutRegression = incidents.filter((incident) => {
    const status = incident.metadata.status;
    const productionIssue = incident.metadata.productionIssue !== "false";
    if (!productionIssue || status === "open") return false;
    return !knownEvalIds.has(incident.metadata.regressionEval || "");
  });
  const openCritical = incidents.filter(
    (incident) =>
      incident.metadata.status === "open" &&
      ["sev1", "sev2"].includes((incident.metadata.severity || "").toLowerCase()),
  );
  const invalidRegressionIds = incidents.filter((incident) => {
    const regressionEval = incident.metadata.regressionEval;
    return Boolean(regressionEval) && !knownEvalIds.has(regressionEval);
  });

  const checks: Check[] = [
    check("rollout incident directory exists", fs.existsSync(INCIDENT_DIR), {
      path: "docs/mcp/mcp-apps/rollout/incidents",
    }),
    check("incident template exists", fileExists("docs", "mcp", "mcp-apps", "rollout", "incident-template.md")),
    check("weekly review checklist exists", fileExists("docs", "mcp", "mcp-apps", "rollout", "weekly-review.md")),
    check("known ChatGPT app evals exist", knownEvalIds.size >= 8, { count: knownEvalIds.size }),
    check("incident frontmatter is complete", missingMetadata.length === 0, {
      files: missingMetadata.map((incident) => incident.file),
    }),
    check("closed production incidents reference regression evals", closedWithoutRegression.length === 0, {
      files: closedWithoutRegression.map((incident) => incident.file),
    }),
    check("regression eval ids are valid", invalidRegressionIds.length === 0, {
      files: invalidRegressionIds.map((incident) => incident.file),
    }),
    check("no open sev1/sev2 incidents", options.allowOpenCritical || openCritical.length === 0, {
      files: openCritical.map((incident) => incident.file),
    }),
  ];

  const passed = checks.every((item) => item.ok);
  const report = {
    suite: "chatgpt-app-phase-9-rollout",
    generatedAt: new Date().toISOString(),
    passed,
    incidentCount: incidents.length,
    checks,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("a8n ChatGPT Apps Phase 9 rollout check");
    console.log(`Incidents: ${incidents.length}`);
    console.log("");
    for (const item of checks) {
      console.log(`- ${item.name}: ${item.ok ? "ok" : "failed"}`);
    }
    console.log("");
    console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  }

  if (!passed) process.exitCode = 1;
}

main();
