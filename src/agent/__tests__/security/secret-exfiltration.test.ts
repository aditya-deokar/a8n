/**
 * Security test: Secret exfiltration prevention.
 *
 * Tests that all known secret patterns are caught by assertNoSecrets,
 * and that memory extraction rejects secret-containing content.
 */

import { describe, it, expect } from "vitest";
import { detectSecret, assertNoSecrets, detectSecretsInRecord } from "@/agent/safety/secret-policy";
import { evaluateMemoryExtraction } from "@/agent/memory/extraction-policy";
import { containsSecretPatterns, redactMemoryContent } from "@/agent/memory/redaction";

describe("Secret Exfiltration Prevention", () => {
  describe("Secret detection patterns", () => {
    const secretTestCases = [
      { input: "My API key is sk-1234567890abcdefghijklmnop", label: "OpenAI API key" },
      { input: "Use ghp_" + "abcdefghijklmnopqrstuvwxyz0123456789 for GitHub", label: "GitHub personal access token" },
      { input: "Slack token: xoxb-123-456-abcdefghijklmnopq", label: "Slack token" },
      { input: "AWS key AKIAIOSFODNN7EXAMPLE", label: "AWS access key" },
      { input: "pk_test_" + "abcdefghijklmnopqrstuvwxyz", label: "Stripe publishable key" },
      { input: "sk_live_" + "abcdefghijklmnopqrstuvwxyz", label: "Stripe secret key" },
      { input: "whsec_" + "abcdefghijklmnopqrstuvwxyz", label: "Stripe webhook secret" },
      { input: "glpat-abcdefghijklmnopqrstuvwxyz", label: "GitLab token" },
      { input: "-----BEGIN RSA PRIVATE KEY-----", label: "PEM key" },
      { input: 'password = "my_super_secret_123"', label: "credential assignment" },
      { input: "api_key: sk_test_" + "abcdefghijklmnop12345678", label: "credential assignment" },
    ];

    for (const { input, label } of secretTestCases) {
      it(`should detect ${label}`, () => {
        const detected = detectSecret(input);
        expect(detected).not.toBeNull();
      });
    }

    it("should not flag normal text", () => {
      expect(detectSecret("Build a workflow that sends emails")).toBeNull();
      expect(detectSecret("I want to connect Google Sheets")).toBeNull();
      expect(detectSecret("Can you explain how triggers work?")).toBeNull();
    });
  });

  describe("assertNoSecrets", () => {
    it("should throw AGENT_SAFETY_BLOCKED for secrets", () => {
      expect(() => assertNoSecrets("sk-1234567890abcdefghijklmnop", "message"))
        .toThrow("safety policy");
    });

    it("should not throw for normal input", () => {
      expect(() => assertNoSecrets("Create a workflow", "message")).not.toThrow();
    });
  });

  describe("Record-level secret detection", () => {
    it("should detect secrets in record values", () => {
      const record = {
        name: "My Workflow",
        apiKey: "sk-1234567890abcdefghijklmnop",
        description: "Normal text",
      };
      const found = detectSecretsInRecord(record);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0].field).toBe("apiKey");
    });

    it("should return empty array for clean records", () => {
      const record = {
        name: "My Workflow",
        description: "Normal text",
      };
      const found = detectSecretsInRecord(record);
      expect(found).toHaveLength(0);
    });
  });

  describe("Memory extraction rejects secrets", () => {
    it("should reject memory content with API keys", () => {
      const result = evaluateMemoryExtraction(
        "User's API key is sk-1234567890abcdefghijklmnop",
      );
      expect(result.decision).toBe("rejected");
    });

    it("should reject memory content with passwords", () => {
      const result = evaluateMemoryExtraction(
        "The password for the database is supersecret123",
      );
      expect(result.decision).toBe("rejected");
    });

    it("should reject memory content with bearer tokens", () => {
      const result = evaluateMemoryExtraction(
        "Use bearer token eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiZGF0YSJ9.abc123",
      );
      expect(result.decision).toBe("rejected");
    });

    it("should allow clean memory content", () => {
      const result = evaluateMemoryExtraction(
        "User prefers to use Google Sheets as the default output destination.",
      );
      expect(result.decision).toBe("allowed");
    });
  });

  describe("Memory content redaction", () => {
    it("should detect secret patterns in content", () => {
      expect(containsSecretPatterns("sk-1234567890abcdefghijklmnop")).toBe(true);
      expect(containsSecretPatterns("Normal text")).toBe(false);
    });

    it("should redact email addresses", () => {
      const result = redactMemoryContent("Contact user@example.com for details");
      expect(result).not.toContain("user@example.com");
      expect(result).toContain("[REDACTED_EMAIL]");
    });

    it("should return null for fully-redacted content", () => {
      const result = redactMemoryContent("sk-1234567890abcdefghijklmnopqrstuvwxyz123456");
      // If the content is entirely a secret, it should be discarded
      expect(result).toBeNull();
    });
  });
});
