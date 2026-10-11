import { describe, expect, it } from "vitest";
import { reorderIds } from "./reorder-ids";

describe("reorderIds", () => {
  const ids = ["a", "b", "c"] as const;

  it("returns null when activeId equals overId", () => {
    expect(reorderIds(ids, "a", "a")).toBeNull();
  });

  it("returns null when an id is not found", () => {
    expect(reorderIds(ids, "x", "b")).toBeNull();
    expect(reorderIds(ids, "a", "x")).toBeNull();
  });

  it.each([
    ["a", "b", ["b", "a", "c"]],
    ["c", "a", ["c", "a", "b"]],
    ["b", "c", ["a", "c", "b"]],
  ])("moves %s to the position of %s", (active, over, expected) => {
    expect(reorderIds(ids, active, over)).toEqual(expected);
  });

  it("does not mutate the original array", () => {
    const original = [...ids];
    reorderIds(original, "a", "c");
    expect(original).toEqual(["a", "b", "c"]);
  });
});
