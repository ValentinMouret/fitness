import { describe, expect, it } from "vitest";
import {
  ExerciseHistorySession,
  type ExerciseHistorySet,
} from "~/modules/fitness/domain/workout";
import {
  createHistorySessionViewModels,
  createProgressMetricViewModels,
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

const progressResponse = exerciseHistoryResponseSchema.parse({
  sessions: [
    {
      workoutId: "w-3",
      workoutName: "Upper A",
      date: "2026-10-20T08:00:00.000Z",
      totalVolume: 1440,
      maxWeight: 82.5,
      estimatedOneRepMax: 99,
      sets: [
        { set: 1, reps: 20, weight: 40, isWarmup: true },
        { set: 2, reps: 6, isWarmup: false },
        { set: 3, reps: 5, isWarmup: false },
      ],
    },
    {
      workoutId: "w-2",
      workoutName: "Upper A",
      date: "2026-10-13T08:00:00.000Z",
      totalVolume: 0,
      sets: [],
    },
    {
      workoutId: "w-1",
      workoutName: "Upper A",
      date: "2026-10-06T08:00:00.000Z",
      totalVolume: 1200,
      maxWeight: 80,
      estimatedOneRepMax: 99,
      sets: [{ set: 1, reps: 8, isWarmup: false }],
    },
  ],
  hasMore: false,
});

describe("createProgressMetricViewModels", () => {
  it("plots weighted metrics oldest first and skips missing values", () => {
    const metrics = createProgressMetricViewModels(progressResponse, false);
    expect(metrics.map((metric) => metric.key)).toEqual([
      "volume",
      "e1rm",
      "top",
    ]);
    const [volume, e1rm, top] = metrics;
    expect(volume.points.map((point) => point.value)).toEqual([1200, 1440]);
    expect(volume.points[0].dateDisplay).toBe("6 Oct");
    expect(volume.latestDisplay).toBe("1,440 kg");
    expect(volume.changeDisplay).toBe("+240 kg since 6 Oct");
    expect(e1rm.changeDisplay).toBe("No change since 6 Oct");
    expect(top.changeDisplay).toBe("+2.5 kg since 6 Oct");
  });

  it("plots working reps for bodyweight exercises", () => {
    const metrics = createProgressMetricViewModels(progressResponse, true);
    expect(metrics.map((metric) => metric.key)).toEqual(["reps", "load"]);
    expect(metrics[0].points.map((point) => point.value)).toEqual([8, 11]);
  });

  it.each([undefined, 0])(
    "includes a completed unweighted bodyweight session in added load: %s",
    (unweightedLoad) => {
      const sessions = [20, 30, unweightedLoad]
        .map((weight, index) =>
          ExerciseHistorySession.fromSets(
            `bw-${index}`,
            "Pull-ups",
            new Date(Date.UTC(2026, 10, 9 + index * 7, 8)),
            [{ set: 1, reps: 8, weight, isWarmup: false }],
          ),
        )
        .reverse();
      const metrics = createProgressMetricViewModels(
        exerciseHistoryResponseSchema.parse({ sessions }),
        true,
      );
      const load = metrics.find((metric) => metric.key === "load");
      expect(load?.points.map((point) => point.value)).toEqual([20, 30, 0]);
      expect(load?.latestDisplay).toBe("0 kg");
      expect(load?.changeDisplay).toBe("−20 kg since 9 Nov");
    },
  );

  it.each<{ readonly sets: ReadonlyArray<ExerciseHistorySet> }>([
    { sets: [] },
    { sets: [{ set: 1, reps: 8, isWarmup: true }] },
    { sets: [{ set: 1, isWarmup: false }] },
    { sets: [{ set: 1, reps: 0, isWarmup: false }] },
    { sets: [{ set: 1, reps: -1, isWarmup: false }] },
    { sets: [{ set: 1, reps: 8, weight: -1, isWarmup: false }] },
  ])(
    "does not invent zero load without valid working reps: $sets",
    ({ sets }) => {
      const sessions = [
        ExerciseHistorySession.fromSets(
          "weighted",
          "Pull-ups",
          new Date("2026-11-09T08:00:00Z"),
          [{ set: 1, reps: 8, weight: 20, isWarmup: false }],
        ),
        ExerciseHistorySession.fromSets(
          "missing",
          "Pull-ups",
          new Date("2026-11-16T08:00:00Z"),
          sets,
        ),
      ];
      expect(
        createProgressMetricViewModels(
          exerciseHistoryResponseSchema.parse({ sessions }),
          true,
        ).find((metric) => metric.key === "load"),
      ).toBeUndefined();
    },
  );

  it("returns no metric without two sessions to compare", () => {
    const [latest] = progressResponse.sessions;
    expect(
      createProgressMetricViewModels({ sessions: [latest] }, false),
    ).toEqual([]);
  });
});
