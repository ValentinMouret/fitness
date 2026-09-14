import { describe, expect, it } from "vitest";
import { isSafePath } from "./utils";

describe("safe local redirects", () => {
  it.each([
    "/",
    "/dashboard",
    "/workouts?q=bench",
    "/oauth/authorize?state=abc%20def",
  ])("accepts %s", (path) => expect(isSafePath(path)).toBe(true));
  it.each([
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\n/evil.test",
    "/\t/evil.test",
    " /dashboard",
  ])("rejects %s", (path) => expect(isSafePath(path)).toBe(false));
});
