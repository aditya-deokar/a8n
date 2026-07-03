import { describe, expect, it } from "vitest";
import { checkEgressUrlSafety } from "@/mcp/safety/egress-policy";

describe("MCP egress URL safety policy", () => {
  it("allows public HTTPS URLs", () => {
    expect(checkEgressUrlSafety("https://api.example.com/v1")).toMatchObject({
      allowed: true,
      reason: "allowed-public-https-url",
    });
  });

  it("blocks insecure schemes and local targets", () => {
    expect(checkEgressUrlSafety("http://api.example.com")).toMatchObject({
      allowed: false,
      reason: "unsupported-or-insecure-scheme",
    });
    expect(checkEgressUrlSafety("https://localhost/admin")).toMatchObject({
      allowed: false,
      reason: "blocked-local-hostname",
    });
    expect(checkEgressUrlSafety("https://169.254.169.254/latest/meta-data")).toMatchObject({
      allowed: false,
      reason: "blocked-private-or-metadata-ip",
    });
    expect(checkEgressUrlSafety("https://metadata.google.internal/computeMetadata/v1")).toMatchObject({
      allowed: false,
      reason: "blocked-local-hostname",
    });
  });
});
