import { describe, expect, it } from "vitest";
import { resolvePlanFromSubscription } from "@/lib/entitlements/get-plan";

const future = new Date("2099-01-01T00:00:00.000Z");
const past = new Date("2020-01-01T00:00:00.000Z");

function row(overrides = {}) {
  return {
    planId: "pro",
    status: "active",
    currentPeriodEnd: future,
    ...overrides,
  };
}

describe("effective plan resolver", () => {
  it("defaults missing subscription rows to free", () => {
    expect(resolvePlanFromSubscription(null)).toBe("free");
  });

  it("never grants pro from a non-pro plan row", () => {
    expect(resolvePlanFromSubscription(row({ planId: "free" }))).toBe("free");
    expect(
      resolvePlanFromSubscription(row({ planId: "enterprise" })),
    ).toBe("free");
  });

  it("treats an active pro subscription as pro", () => {
    expect(resolvePlanFromSubscription(row())).toBe("pro");
  });

  it("keeps canceled pro access until the paid period ends", () => {
    expect(resolvePlanFromSubscription(row({ status: "canceled" }))).toBe("pro");
    expect(
      resolvePlanFromSubscription(row({ status: "canceled", currentPeriodEnd: past })),
    ).toBe("free");
  });

  it("grants a dunning grace window for past_due until period end", () => {
    expect(resolvePlanFromSubscription(row({ status: "past_due" }))).toBe("pro");
    expect(
      resolvePlanFromSubscription(row({ status: "past_due", currentPeriodEnd: null })),
    ).toBe("free");
    expect(
      resolvePlanFromSubscription(row({ status: "past_due", currentPeriodEnd: past })),
    ).toBe("free");
  });

  it("collapses unknown statuses to free even with a live period end", () => {
    expect(resolvePlanFromSubscription(row({ status: "incomplete" }))).toBe(
      "free",
    );
  });
});
