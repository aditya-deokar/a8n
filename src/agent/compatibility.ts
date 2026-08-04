/**
 * Package compatibility verification.
 *
 * Checks LangChain/LangGraph package versions at startup and logs
 * warnings if versions are outside the tested range.
 */

import fs from "node:fs";
import { emitAgentEvent } from "@/agent/observability/tracing";

/**
 * Tested package version ranges.
 * These are the versions the agent was developed and tested against.
 */
const TESTED_PACKAGES: Record<string, { minVersion: string; maxVersion: string }> = {
  "@langchain/core": { minVersion: "0.3.0", maxVersion: "0.4.0" },
  "@langchain/openai": { minVersion: "0.3.0", maxVersion: "0.4.0" },
  "@langchain/langgraph": { minVersion: "0.2.0", maxVersion: "0.3.0" },
  "@langchain/mcp-adapters": { minVersion: "0.1.0", maxVersion: "0.2.0" },
  "@modelcontextprotocol/sdk": { minVersion: "1.0.0", maxVersion: "2.0.0" },
};

/**
 * Parse a semver string into comparable components.
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semver versions.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
function compareSemver(a: string, b: string): number {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;

  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  return 0;
}

export type CompatibilityIssue = {
  package: string;
  installedVersion: string;
  testedRange: string;
  severity: "warning" | "error";
  message: string;
};

/**
 * Check package compatibility and return any issues found.
 *
 * This function attempts to read package.json version fields
 * from installed packages and compares them against the tested ranges.
 */
export function checkPackageCompatibility(): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  for (const [pkgName, range] of Object.entries(TESTED_PACKAGES)) {
    try {
      // Attempt to resolve the package
      const pkgPath = require.resolve(`${pkgName}/package.json`);
      const pkgContent = fs.readFileSync(pkgPath, "utf8");
      const pkg = JSON.parse(pkgContent) as { version?: string };
      const version = pkg.version;

      if (!version) {
        issues.push({
          package: pkgName,
          installedVersion: "unknown",
          testedRange: `${range.minVersion} - ${range.maxVersion}`,
          severity: "warning",
          message: `Cannot determine installed version of ${pkgName}.`,
        });
        continue;
      }

      const belowMin = compareSemver(version, range.minVersion) < 0;
      const aboveMax = compareSemver(version, range.maxVersion) >= 0;

      if (belowMin) {
        issues.push({
          package: pkgName,
          installedVersion: version,
          testedRange: `${range.minVersion} - ${range.maxVersion}`,
          severity: "error",
          message: `${pkgName}@${version} is below the minimum tested version ${range.minVersion}.`,
        });
      } else if (aboveMax) {
        issues.push({
          package: pkgName,
          installedVersion: version,
          testedRange: `${range.minVersion} - ${range.maxVersion}`,
          severity: "warning",
          message: `${pkgName}@${version} is above the maximum tested version ${range.maxVersion}. Verify compatibility.`,
        });
      }
    } catch {
      issues.push({
        package: pkgName,
        installedVersion: "not_installed",
        testedRange: `${range.minVersion} - ${range.maxVersion}`,
        severity: "warning",
        message: `${pkgName} is not installed or cannot be resolved.`,
      });
    }
  }

  // Emit observability event if issues are found
  if (issues.length > 0) {
    emitAgentEvent("compatibility.check.issues", {
      issueCount: issues.length,
      issues: issues.map((i) => ({
        package: i.package,
        version: i.installedVersion,
        severity: i.severity,
      })),
    });
  }

  return issues;
}
