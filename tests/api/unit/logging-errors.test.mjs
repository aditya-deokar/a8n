import { describe, expect, it } from "vitest";
import { normalizeError } from "@/lib/logging/errors";

describe("logging error normalization", () => {
  it("serializes errors without leaking secret values", () => {
    const error = new Error(
      "failed with Bearer abcdefghijklmno and postgresql://user:password@db/app",
    );
    error.code = "E_TEST";

    const normalized = normalizeError(error);

    expect(normalized).toMatchObject({
      code: "E_TEST",
      name: "Error",
    });
    expect(normalized.message).toContain("Bearer [REDACTED]");
    expect(normalized.message).toContain("[REDACTED_DATABASE_URL]");
    expect(normalized.message).not.toContain("password");
  });

  it("normalizes non-error throwables", () => {
    expect(normalizeError("sk-live-abcdefghijk")).toEqual({
      name: "UnknownError",
      message: "[REDACTED_SECRET]",
    });
  });
});
