import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Unit tests for user logout endpoint
 * Tests logout returns success response
 * 
 * **Validates: Requirements 6.1**
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("should return success response", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
  });

  it("should accept logout request without parameters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw an error
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
