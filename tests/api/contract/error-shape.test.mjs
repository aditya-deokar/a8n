import { beforeEach, describe, expect, it } from "vitest";
import {
  createAppCaller,
  expectTrpcCode,
  resetApiTestMocks,
  setAnonymousApiUser,
  setPremiumSubscription,
} from "../helpers/trpc-caller.mjs";
import { apiUsers } from "../fixtures/auth-fixtures.mjs";
import { setApiUser } from "../helpers/trpc-caller.mjs";

describe("internal API error shape", () => {
  beforeEach(() => {
    resetApiTestMocks();
  });

  it("uses UNAUTHORIZED for missing sessions", async () => {
    setAnonymousApiUser();
    const caller = await createAppCaller();

    await expect(caller.workflows.getMany({ page: 1, pageSize: 5, search: "" })).rejects.toSatisfy(
      (error) => {
        expectTrpcCode(error, "UNAUTHORIZED");
        expect(error.message).toMatch(/Unathorized|Unauthorized/i);
        return true;
      },
    );
  });

  it("uses FORBIDDEN for premium procedures without an active subscription", async () => {
    setApiUser(apiUsers.userAFree);
    setPremiumSubscription(false);
    const caller = await createAppCaller();

    await expect(caller.workflows.create()).rejects.toSatisfy((error) => {
      expectTrpcCode(error, "FORBIDDEN");
      expect(error.message).toContain("Active subscription required");
      return true;
    });
  });
});
