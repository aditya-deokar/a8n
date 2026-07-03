import { describe, expect, it } from "vitest";
import { PAGINATION } from "@/config/constants";

describe("API pagination constants", () => {
  it("keeps default page size inside the accepted bounds", () => {
    expect(PAGINATION.DEFAULT_PAGE).toBeGreaterThanOrEqual(1);
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(PAGINATION.MIN_PAGE_SIZE);
    expect(PAGINATION.DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(PAGINATION.MAX_PAGE_SIZE);
  });
});
