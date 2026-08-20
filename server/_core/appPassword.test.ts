import { describe, expect, it } from "vitest";
import { hashAppPassword, verifyAppPassword } from "./appPassword";

describe("app password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashAppPassword("correct horse battery staple");
    expect(await verifyAppPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashAppPassword("correct horse battery staple");
    expect(await verifyAppPassword("wrong password", hash)).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyAppPassword("anything", "not-a-valid-hash")).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const first = await hashAppPassword("same password");
    const second = await hashAppPassword("same password");
    expect(first).not.toBe(second);
    expect(await verifyAppPassword("same password", second)).toBe(true);
  });
});
