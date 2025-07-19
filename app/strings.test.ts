import { describe, expect, it } from "vitest";
import { capitalize } from "./strings";

describe("capitalize", () => {
  it("should capitalize the first letter of a string", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("should not mutate the original string", () => {
    const str = "hello";
    capitalize(str);
    expect(str).toBe("hello");
  });

  it("should return an empty string if input is empty", () => {
    expect(capitalize("")).toBe("");
  });
});
