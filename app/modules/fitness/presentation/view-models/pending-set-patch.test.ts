import { describe, expect, it } from "vitest";
import { pendingSetPatch } from "./pending-set-patch";

const form = (fields: Readonly<Record<string, string>>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

describe("pendingSetPatch", () => {
  it("reads a set update", () => {
    expect(
      pendingSetPatch(
        form({
          intent: "update-set",
          exerciseId: "bench",
          setNumber: "2",
          isCompleted: "true",
          reps: "8",
          reportedRir: "",
        }),
      ),
    ).toEqual({
      exerciseId: "bench",
      setNumber: 2,
      isCompleted: true,
      reps: 8,
      reportedRir: null,
    });
  });

  it("reads a completed set", () => {
    expect(
      pendingSetPatch(
        form({ intent: "complete-set", exerciseId: "bench", setNumber: "1" }),
      ),
    ).toEqual({ exerciseId: "bench", setNumber: 1, isCompleted: true });
  });

  it("reads a removed set", () => {
    expect(
      pendingSetPatch(
        form({ intent: "remove-set", exerciseId: "bench", setNumber: "3" }),
      ),
    ).toEqual({ exerciseId: "bench", setNumber: 3, removed: true });
  });

  it("ignores other submissions", () => {
    expect(pendingSetPatch(form({ intent: "update-name", name: "A" }))).toBe(
      undefined,
    );
    expect(pendingSetPatch(undefined)).toBeUndefined();
  });
});
