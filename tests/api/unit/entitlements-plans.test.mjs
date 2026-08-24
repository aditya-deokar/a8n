import { describe, expect, it } from "vitest";
import { evaluateQuota } from "@/lib/entitlements/check-quota";
import {
  calendarMonthWindow,
  utcDayWindow,
  windowContains,
} from "@/lib/entitlements/windows";

describe("entitlements quota evaluation", () => {
  it("allows usage below a numeric limit", () => {
    expect(
      evaluateQuota({ plan: "free", feature: "workflow", used: 4, limit: 5 }),
    ).toMatchObject({ allowed: true, used: 4, limit: 5 });
  });

  it("denies usage at the numeric limit and reports the numbers", () => {
    const verdict = evaluateQuota({
      plan: "free",
      feature: "agent_chat",
      used: 25,
      limit: 25,
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict).toMatchObject({
      feature: "agent_chat",
      plan: "free",
      used: 25,
      limit: 25,
    });
  });

  it("treats null limits as unlimited for every feature", () => {
    for (const feature of ["workflow", "credential", "agent_chat"]) {
      const verdict = evaluateQuota({
        plan: "pro",
        feature,
        used: 100_000,
        limit: null,
      });
      expect(verdict.allowed).toBe(true);
    }
  });

  it("defaults to deny when usage somehow exceeds the limit", () => {
    expect(
      evaluateQuota({ plan: "free", feature: "credential", used: 11, limit: 10 })
        .allowed,
    ).toBe(false);
  });
});

describe("quota windows", () => {
  it("builds UTC calendar-month windows", () => {
    const window = calendarMonthWindow(new Date("2026-03-15T10:30:00.000Z"));
    expect(window.periodStart.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(window.periodEnd.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("rolls January into February across the year boundary", () => {
    const window = calendarMonthWindow(new Date("2026-12-31T23:59:59.999Z"));
    expect(window.periodEnd.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("treats month end as exclusive and next month start as inside", () => {
    const window = calendarMonthWindow(new Date("2026-08-02T00:00:00.000Z"));
    expect(windowContains(window, new Date("2026-07-31T23:59:59.999Z"))).toBe(
      false,
    );
    expect(windowContains(window, new Date("2026-08-01T00:00:00.000Z"))).toBe(
      true,
    );
    expect(windowContains(window, new Date("2026-09-01T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("builds UTC day windows with exact 24h spans", () => {
    const window = utcDayWindow(new Date("2026-08-22T18:05:12.000Z"));
    expect(window.periodStart.toISOString()).toBe("2026-08-22T00:00:00.000Z");
    expect(window.periodEnd.toISOString()).toBe("2026-08-23T00:00:00.000Z");
  });
});
