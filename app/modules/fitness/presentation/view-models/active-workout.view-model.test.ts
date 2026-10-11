import { describe, expect, it } from "vitest";
import type {
  Exercise,
  WorkoutSession,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";
import {
  applySetPatches,
  createActiveWorkoutViewModel,
  formatRir,
  setLabels,
  toActiveWorkoutState,
} from "./active-workout.view-model";

const workoutId = "w-1";

const exercise = (id: string, type: Exercise["type"]): Exercise => ({
  id,
  name: id,
  type,
  movementPattern: "push",
});

const set = (
  exerciseId: string,
  overrides: Partial<WorkoutSet>,
): WorkoutSet => ({
  workoutId,
  exerciseId,
  set: 1,
  isCompleted: false,
  isFailure: false,
  isWarmup: false,
  ...overrides,
});

const session: WorkoutSession = {
  workout: {
    id: workoutId,
    name: "Upper A",
    start: new Date("2026-10-10T08:00:00Z"),
  },
  exerciseGroups: [
    {
      exercise: exercise("pull-up", "bodyweight"),
      orderIndex: 1,
      sets: [
        set("pull-up", {
          set: 1,
          reps: 8,
          isCompleted: true,
          reportedRir: "unsure",
        }),
        set("pull-up", { set: 2, targetReps: 6, weight: 10 }),
      ],
    },
    {
      exercise: exercise("bench", "barbell"),
      orderIndex: 0,
      sets: [
        set("bench", {
          set: 1,
          reps: 10,
          weight: 40,
          isWarmup: true,
          isCompleted: true,
        }),
        set("bench", {
          set: 3,
          reps: 8,
          weight: 80,
          isCompleted: true,
          reportedRir: "4+",
        }),
      ],
    },
  ],
};

describe("createActiveWorkoutViewModel", () => {
  const viewModel = createActiveWorkoutViewModel(toActiveWorkoutState(session));

  it("orders exercises and totals progress", () => {
    expect(viewModel.exercises.map((e) => e.id)).toEqual(["bench", "pull-up"]);
    expect(viewModel).toMatchObject({
      completedSets: 3,
      totalSets: 4,
      completedExercises: 1,
      start: "2026-10-10T08:00:00.000Z",
    });
    expect(viewModel.exercises.map((e) => e.status)).toEqual([
      "done",
      "active",
    ]);
  });

  it("numbers working sets separately from warm-ups", () => {
    expect(viewModel.exercises[0].sets.map((s) => s.label)).toEqual(["W", "1"]);
  });

  it("marks the first incomplete set as next", () => {
    expect(viewModel.exercises[1].sets.map((s) => s.isNext)).toEqual([
      false,
      true,
    ]);
  });

  it("shows planned reps as a target until reps are logged", () => {
    const [done, planned] = viewModel.exercises[1].sets;
    expect(done.reps).toEqual({ value: 8, display: "8", isTarget: false });
    expect(planned.reps).toEqual({ target: 6, display: "6", isTarget: true });
  });

  it("shows bodyweight without added load as BW", () => {
    const [unloaded, loaded] = viewModel.exercises[1].sets;
    expect(unloaded.weight.display).toBe("BW");
    expect(loaded.weight).toEqual({
      value: 10,
      display: "10",
      isTarget: false,
    });
  });

  it("keeps the database set number for writes", () => {
    expect(viewModel.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 3]);
  });

  it("treats an exercise without sets as pending", () => {
    const empty = createActiveWorkoutViewModel(
      toActiveWorkoutState({
        ...session,
        exerciseGroups: [
          { exercise: exercise("row", "cable"), orderIndex: 0, sets: [] },
        ],
      }),
    );
    expect(empty.exercises[0].status).toBe("pending");
  });
});

describe("legacy effort", () => {
  it("shows RPE only when no RIR was reported", () => {
    const viewModel = createActiveWorkoutViewModel(
      toActiveWorkoutState({
        ...session,
        exerciseGroups: [
          {
            exercise: exercise("row", "cable"),
            orderIndex: 0,
            sets: [
              set("row", { set: 1, reps: 8, isCompleted: true, rpe: 8 }),
              set("row", {
                set: 2,
                reps: 8,
                isCompleted: true,
                rpe: 9,
                reportedRir: "1",
              }),
            ],
          },
        ],
      }),
    );
    expect(
      viewModel.exercises[0].sets.map((s) => [s.effortLabel, s.rirDisplay]),
    ).toEqual([
      ["RPE", "8"],
      ["RIR", "1"],
    ]);
  });
});

describe("applySetPatches", () => {
  const state = toActiveWorkoutState(session);
  const pullUps = (patched: typeof state) =>
    patched.exercises.find((exercise) => exercise.id === "pull-up")?.sets ?? [];

  it("returns the same state without patches", () => {
    expect(applySetPatches(state, [])).toBe(state);
  });

  it("applies values and clears nulls", () => {
    const patched = applySetPatches(state, [
      { exerciseId: "pull-up", setNumber: 2, isCompleted: true, reps: 6 },
      { exerciseId: "pull-up", setNumber: 2, reportedRir: "1", weight: null },
    ]);
    expect(pullUps(patched)[1]).toMatchObject({
      isCompleted: true,
      reps: 6,
      reportedRir: "1",
      weight: undefined,
    });
  });

  it("drops RIR from a set marked as a warm-up", () => {
    const patched = applySetPatches(state, [
      { exerciseId: "pull-up", setNumber: 1, isWarmup: true },
    ]);
    expect(pullUps(patched)[0]).toMatchObject({
      isWarmup: true,
      reportedRir: undefined,
    });
  });

  it("hides removed sets", () => {
    const patched = applySetPatches(state, [
      { exerciseId: "pull-up", setNumber: 1, removed: true },
    ]);
    expect(pullUps(patched).map((set) => set.setNumber)).toEqual([2]);
  });
});

describe("formatRir", () => {
  it.each([
    [undefined, "–"],
    ["unsure", "?"],
    ["0", "0"],
    ["4+", "4+"],
  ] as const)("formats %s as %s", (rir, expected) => {
    expect(formatRir(rir)).toBe(expected);
  });
});

describe("setLabels", () => {
  it("restarts numbering after leading warm-ups", () => {
    expect(
      setLabels([
        { isWarmup: true },
        { isWarmup: true },
        { isWarmup: false },
        { isWarmup: false },
      ]),
    ).toEqual(["W", "W", "1", "2"]);
  });
});
