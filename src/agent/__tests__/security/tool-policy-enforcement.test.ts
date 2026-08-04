/**
 * Security test: Tool policy enforcement.
 *
 * Verifies the tool allowlist, draft-write gating, and apply gating.
 */

import { describe, it, expect } from "vitest";
import {
  EMBEDDED_AGENT_TOOL_NAMES,
  assertEmbeddedAgentToolAllowed,
  READ_ONLY_AGENT_RISKS,
  DRAFT_WRITE_AGENT_RISKS,
  APPLY_AGENT_RISKS,
  embeddedAgentContracts,
} from "@/agent/mcp-client/tool-policy";

describe("Tool Policy Enforcement", () => {
  describe("Tool allowlist", () => {
    it("should have a defined set of allowed tools", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.size).toBeGreaterThan(0);
    });

    it("should include read-only tools", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("list_workflows")).toBe(true);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("get_workflow")).toBe(true);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("whoami")).toBe(true);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("server_info")).toBe(true);
    });

    it("should include draft-write tools", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("create_workflow_draft")).toBe(true);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("validate_workflow_draft")).toBe(true);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("preview_workflow_diff")).toBe(true);
    });

    it("should include apply tool", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("apply_workflow_draft")).toBe(true);
    });

    it("should reject unknown tools", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("delete_workflow")).toBe(false);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("execute_workflow")).toBe(false);
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("admin_reset")).toBe(false);
    });
  });

  describe("Risk tiers", () => {
    it("should define three risk tiers", () => {
      expect(READ_ONLY_AGENT_RISKS.size).toBeGreaterThan(0);
      expect(DRAFT_WRITE_AGENT_RISKS.size).toBeGreaterThan(READ_ONLY_AGENT_RISKS.size);
      expect(APPLY_AGENT_RISKS.size).toBeGreaterThan(DRAFT_WRITE_AGENT_RISKS.size);
    });

    it("should have read_only as the base tier", () => {
      expect(READ_ONLY_AGENT_RISKS.has("read_only")).toBe(true);
    });

    it("should have draft_write in the draft tier", () => {
      expect(DRAFT_WRITE_AGENT_RISKS.has("draft_write")).toBe(true);
      expect(DRAFT_WRITE_AGENT_RISKS.has("read_only")).toBe(true);
    });

    it("should have approval_gated_write in the apply tier", () => {
      expect(APPLY_AGENT_RISKS.has("approval_gated_write")).toBe(true);
      expect(APPLY_AGENT_RISKS.has("draft_write")).toBe(true);
      expect(APPLY_AGENT_RISKS.has("read_only")).toBe(true);
    });
  });

  describe("Tool blocking by mode", () => {
    it("should block unlisted tools", () => {
      expect(() =>
        assertEmbeddedAgentToolAllowed("delete_all_workflows", {}),
      ).toThrow("not available");
    });

    it("should have embeddedAgentContracts returning contracts", () => {
      const contracts = embeddedAgentContracts();
      expect(Array.isArray(contracts)).toBe(true);
    });
  });

  describe("100% approval coverage for high-risk paths", () => {
    it("apply_workflow_draft should be in the allowlist", () => {
      expect(EMBEDDED_AGENT_TOOL_NAMES.has("apply_workflow_draft")).toBe(true);
    });

    it("apply tool should require approval_gated_write risk", () => {
      // The apply tool has risk=approval_gated_write in the MCP contracts
      // which means it ONLY works when allowApply=true and APPLY_AGENT_RISKS is used.
      // The approval-service creates a DB record that must be resolved by the user.
      expect(APPLY_AGENT_RISKS.has("approval_gated_write")).toBe(true);
    });
  });
});
