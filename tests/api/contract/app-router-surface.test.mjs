import { beforeEach, describe, expect, it } from "vitest";
import { expectedApiProcedurePaths } from "../helpers/procedure-cases.mjs";
import { getRouterProcedurePaths } from "../helpers/router-introspection.mjs";
import { loadAppRouter, resetApiTestMocks } from "../helpers/trpc-caller.mjs";

describe("internal API appRouter surface", () => {
  beforeEach(() => {
    resetApiTestMocks();
  });

  it("exposes the expected tRPC procedure paths", async () => {
    const appRouter = await loadAppRouter();

    expect(getRouterProcedurePaths(appRouter)).toEqual(expectedApiProcedurePaths);
  });

  it("keeps all procedures behind protected or premium access in the phase 0 matrix", () => {
    expect(expectedApiProcedurePaths).toHaveLength(40);
  });
});
