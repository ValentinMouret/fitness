import { describe, expect, it } from "vitest";
import { syncSessionFromCookie } from "./session-sync";

describe("syncSessionFromCookie", () => {
  it("returns null on server (no window)", () => {
    const result = syncSessionFromCookie();
    expect(result).toBeNull();
  });
});
