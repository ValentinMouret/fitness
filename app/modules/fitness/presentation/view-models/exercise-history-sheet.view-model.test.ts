import { describe, expect, it } from "vitest";
import {
  createHistorySessionViewModels,
  exerciseHistoryResponseSchema,
} from "./exercise-history-sheet.view-model";

const response = exerciseHistoryResponseSchema.parse({
  sessions: [
    {
      workoutId: "w-1",
      workoutName: "Upper A",
      date: "2026-10-06T08:00:00.000Z",
      totalVolume: 1200,
      sets: [
        { set: 1, reps: 10, weight: 40, isWarmup: true },
        { set: 2, reps: 8, weight: 77.5, isWarmup: false, reportedRir: "4+" },
        { set: 4, reps: 6, isWarmup: false, reportedRir: "unsure" },
        { set: 5, reps: 5, weight: 80, isWarmup: false, rpe: 9 },
      ],
    },
  ],
  hasMore: false,
});

describe("createHistorySessionViewModels", () => {
  it("labels sets and formats loads and RIR", () => {
    const [session] = createHistorySessionViewModels(response, false);
    expect(session.dateDisplay).toBe("Tue 6 Oct");
    expect(
      session.sets.map((set) => [
        set.label,
        set.repsDisplay,
        set.weightDisplay,
        set.rirDisplay,
      ]),
    ).toEqual([
      ["W", "10", "40 kg", ""],
      ["1", "8", "77.5 kg", "RIR 4+"],
      ["2", "6", "–", "RIR ?"],
      ["3", "5", "80 kg", "RPE 9"],
    ]);
  });

  it("shows bodyweight load as added weight", () => {
    const [session] = createHistorySessionViewModels(response, true);
    expect(session.sets.map((set) => set.weightDisplay)).toEqual([
      "+40 kg",
      "+77.5 kg",
      "BW",
      "+80 kg",
    ]);
  });

  it("rejects an unexpected response", () => {
    expect(
      exerciseHistoryResponseSchema.safeParse({ sessions: [{ date: 1 }] })
        .success,
    ).toBe(false);
  });
});
