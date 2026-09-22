import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./nutrition-errors.server";

describe("nutrition constraint errors", () => {
  it("recognizes direct and wrapped PostgreSQL unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(
      isUniqueViolation(
        new Error("query failed", { cause: { code: "23505" } }),
      ),
    ).toBe(true);
  });
  it("does not label other failures as conflicts", () => {
    for (const error of [
      null,
      undefined,
      "23505",
      { code: "23503" },
      new Error("failed"),
    ]) {
      expect(isUniqueViolation(error)).toBe(false);
    }
    const error = new Error("self-referencing error");
    error.cause = error;
    expect(isUniqueViolation(error)).toBe(false);
  });
});
