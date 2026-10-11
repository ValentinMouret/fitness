import { describe, expect, it } from "vitest";
import type { SnapshotSet } from "./ActiveWorkoutSet";
import { mergeDraft, type PendingDraft } from "./active-workout-draft";

const saved: SnapshotSet = {
  set: 1,
  reps: 8,
  weight: 25,
  targetReps: 10,
  reportedRir: "2",
  isCompleted: true,
  isWarmup: false,
  isFailure: false,
  note: null,
  rpe: null,
};
const draft: PendingDraft = {
  revision: "old",
  baseline: { reps: "8", weight: "20", reportedRir: "1" },
  values: { reps: "7", weight: "20", reportedRir: "1" },
};
describe("active workout refreshed drafts", () => {
  it("preserves only edited reps while adopting independently changed saved weight and RIR", () => {
    expect(mergeDraft(draft, saved)).toEqual({
      reps: "7",
      weight: "25",
      reportedRir: "2",
    });
  });
  it("retains an explicit clear as a dirty input while adopting untouched fields", () => {
    expect(
      mergeDraft(
        { ...draft, values: { ...draft.values, weight: "", reportedRir: "" } },
        saved,
      ),
    ).toEqual({ reps: "7", weight: "", reportedRir: "" });
  });
  it("uses persisted actuals without filling from a prescription", () => {
    expect(
      mergeDraft(undefined, {
        ...saved,
        reps: null,
        weight: null,
        reportedRir: null,
      }),
    ).toEqual({ reps: "", weight: "", reportedRir: "" });
  });
});
