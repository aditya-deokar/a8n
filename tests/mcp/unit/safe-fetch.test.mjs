import { describe, expect, it, vi } from "vitest";
import {
  isSafeFetchDomainAllowed,
  safeFetch,
  SafeFetchError,
} from "@/lib/safe-fetch";

describe("MCP safeFetch", () => {
  it("allows known provider domains and configured subdomains", () => {
    expect(isSafeFetchDomainAllowed("api.openai.com")).toBe(true);
    expect(isSafeFetchDomainAllowed("hooks.slack.com")).toBe(true);
    expect(isSafeFetchDomainAllowed("tenant.example.com", ["example.com"])).toBe(true);
  });

  it("blocks local and metadata targets before fetch is called", async () => {
    const fetchImpl = vi.fn(async () => new Response("should-not-run"));

    await expect(
      safeFetch("https://169.254.169.254/latest/meta-data", { fetchImpl }),
    ).rejects.toMatchObject({
      reason: "blocked-private-or-metadata-ip",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("validates redirects hop by hop", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://localhost/admin" },
      }),
    );

    await expect(
      safeFetch("https://api.openai.com/v1/models", { fetchImpl }),
    ).rejects.toMatchObject({
      reason: "blocked-local-hostname",
    });
  });

  it("enforces allowlist mode and response size limits", async () => {
    await expect(
      safeFetch("https://not-allowed.example.com", {
        allowlistMode: true,
        fetchImpl: vi.fn(async () => new Response("ok")),
      }),
    ).rejects.toMatchObject({
      reason: "blocked-domain-not-allowlisted",
    });

    await expect(
      safeFetch("https://api.openai.com/v1/models", {
        maxResponseBytes: 2,
        fetchImpl: vi.fn(async () => new Response("too-large")),
      }),
    ).rejects.toBeInstanceOf(SafeFetchError);
  });
});
