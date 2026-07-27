import { describe, expect, it } from "vitest";
import { capitalize, isOneOf } from "./strings";

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

describe("isOneOf", () => {
  const values = ["first", "second"] as const;

  it("recognizes a value in the allowed set", () => {
    expect(isOneOf(values, "first")).toBe(true);
  });

  it("rejects a value outside the allowed set", () => {
    expect(isOneOf(values, "third")).toBe(false);
  });
});
