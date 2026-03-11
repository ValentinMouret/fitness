import { ResultAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GeneratedExerciseSet,
  GeneratedWorkout,
} from "~/modules/fitness/domain/ai-generation";
import type { Exercise } from "~/modules/fitness/domain/workout";

// Mock dependencies before importing the module under test
const mockTransaction = vi.fn();
vi.mock("~/db", () => ({
  db: { transaction: (...args: unknown[]) => mockTransaction(...args) },
}));

vi.mock("~/db/schema", () => ({
  workouts: { id: "workouts.id" },
  workoutExercises: {},
  workoutSets: {},
}));

vi.mock("~/logger.server", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockListAll = vi.fn();
vi.mock("~/modules/fitness/infra/repository.server", () => ({
  ExerciseRepository: { listAll: (...args: unknown[]) => mockListAll(...args) },
}));

const mockLinkConversation = vi.fn();
vi.mock(
  "~/modules/fitness/infra/ai-workout-generation.repository.server",
  () => ({
    AIWorkoutGenerationRepository: {
      linkConversationToWorkout: (...args: unknown[]) =>
        mockLinkConversation(...args),
    },
  }),
);

import { logger } from "~/logger.server";
import { createWorkoutFromGeneration } from "./create-workout-from-generation.service.server";

const createExercise = (overrides?: Partial<Exercise>): Exercise => ({
  id: "exercise-1",
  name: "Bench Press",
  type: "barbell",
  movementPattern: "push",
  ...overrides,
});

const createSet = (
  overrides?: Partial<GeneratedExerciseSet>,
): GeneratedExerciseSet => ({
  setNumber: 1,
  targetReps: 10,
  targetWeight: 60,
  isWarmup: false,
  restSeconds: 120,
  ...overrides,
});

const createGeneratedWorkout = (
  overrides?: Partial<GeneratedWorkout>,
): GeneratedWorkout => ({
  name: "Push Day",
  rationale: "Focus on chest",
  estimatedDuration: 60,
  exercises: [
    {
      exerciseId: "exercise-1",
      exerciseName: "Bench Press",
      sets: [createSet()],
    },
  ],
  ...overrides,
});

// biome-ignore lint/complexity/noBannedTypes: vi.fn callbacks use Function type
type TxCallback = Function;

function createMockTx(onValues: (val: Record<string, unknown>) => unknown) {
  const values = vi.fn().mockImplementation(onValues);
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values };
}

describe("createWorkoutFromGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkConversation.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve()),
    );
  });

  it("creates a workout with valid exercises in a single transaction", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedWorkoutExercises: Record<string, unknown>[] = [];
    const insertedWorkoutSets: Record<string, unknown>[] = [];
    let insertedWorkout: Record<string, unknown> | null = null;

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          insertedWorkout = val;
          return {
            returning: vi.fn().mockResolvedValue([{ id: "workout-123" }]),
          };
        }
        if ("workout_id" in val && "exercise_id" in val) {
          insertedWorkoutExercises.push(val);
          return Promise.resolve();
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedWorkoutSets.push(val);
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const response = await createWorkoutFromGeneration(
      createGeneratedWorkout(),
      "conversation-1",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/workouts/workout-123");

    expect(insertedWorkout).toMatchObject({
      name: "Push Day",
      imported_from_strong: false,
      imported_from_fitbod: false,
    });

    expect(insertedWorkoutExercises).toHaveLength(1);
    expect(insertedWorkoutExercises[0]).toMatchObject({
      workout_id: "workout-123",
      exercise_id: "exercise-1",
      order_index: 0,
    });

    expect(insertedWorkoutSets).toHaveLength(1);
    expect(insertedWorkoutSets[0]).toMatchObject({
      workout: "workout-123",
      exercise: "exercise-1",
      set: 1,
      targetReps: 10,
      weight: 60,
      isWarmup: false,
      isCompleted: false,
    });
  });

  it("converts zero targetWeight to null (DB constraint: weight > 0)", async () => {
    const exercises = [createExercise({ id: "bw-exercise", name: "Pull-up" })];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedSets: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedSets.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "bw-exercise",
          exerciseName: "Pull-up",
          sets: [
            createSet({ setNumber: 1, targetWeight: 0 }),
            createSet({ setNumber: 2, targetWeight: 0 }),
          ],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedSets).toHaveLength(2);
    for (const set of insertedSets) {
      expect(set.weight).toBeNull();
    }
  });

  it("converts zero targetReps to null (DB constraint: targetReps > 0)", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedSets: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedSets.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "exercise-1",
          exerciseName: "Bench Press",
          sets: [createSet({ targetReps: 0 })],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedSets[0].targetReps).toBeNull();
  });

  it("fixes zero-indexed set numbers (DB constraint: set > 0)", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedSets: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedSets.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "exercise-1",
          exerciseName: "Bench Press",
          sets: [
            createSet({ setNumber: 0, targetReps: 8 }),
            createSet({ setNumber: 0, targetReps: 8 }),
          ],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    // Zero-indexed setNumbers should be converted to 1-indexed
    expect(insertedSets[0].set).toBe(1);
    expect(insertedSets[1].set).toBe(2);
  });

  it("skips exercises not found in the catalog", async () => {
    const exercises = [createExercise({ id: "real-exercise" })];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedExercises: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout_id" in val && "exercise_id" in val) {
          insertedExercises.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "hallucinated-id",
          exerciseName: "Fake Exercise",
          sets: [createSet()],
        },
        {
          exerciseId: "real-exercise",
          exerciseName: "Real Exercise",
          sets: [createSet()],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedExercises).toHaveLength(1);
    expect(insertedExercises[0].exercise_id).toBe("real-exercise");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: "hallucinated-id" }),
      expect.any(String),
    );
  });

  it("throws 422 when all exercises are invalid", async () => {
    const exercises = [createExercise({ id: "real-exercise" })];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "bad-id-1",
          exerciseName: "Fake 1",
          sets: [createSet()],
        },
        {
          exerciseId: "bad-id-2",
          exerciseName: "Fake 2",
          sets: [createSet()],
        },
      ],
    });

    await expect(
      createWorkoutFromGeneration(workout, "conv-1"),
    ).rejects.toThrow();
  });

  it("links conversation to created workout", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-42" }]) };
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    await createWorkoutFromGeneration(createGeneratedWorkout(), "conv-42");

    expect(mockLinkConversation).toHaveBeenCalledWith("conv-42", "w-42");
  });

  it("preserves warmup and exercise notes", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedExercises: Record<string, unknown>[] = [];
    const insertedSets: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout_id" in val && "exercise_id" in val) {
          insertedExercises.push(val);
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedSets.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "exercise-1",
          exerciseName: "Bench Press",
          notes: "Focus on mind-muscle connection",
          sets: [
            createSet({ setNumber: 1, isWarmup: true, targetWeight: 20 }),
            createSet({ setNumber: 2, isWarmup: false, targetWeight: 80 }),
          ],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedExercises[0].notes).toBe("Focus on mind-muscle connection");
    expect(insertedSets[0].isWarmup).toBe(true);
    expect(insertedSets[1].isWarmup).toBe(false);
  });

  it("handles multiple exercises with correct order indices", async () => {
    const exercises = [
      createExercise({ id: "ex-1", name: "Bench Press" }),
      createExercise({ id: "ex-2", name: "Incline DB Press" }),
      createExercise({ id: "ex-3", name: "Cable Fly" }),
    ];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedExercises: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout_id" in val && "exercise_id" in val) {
          insertedExercises.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "ex-1",
          exerciseName: "Bench Press",
          sets: [createSet()],
        },
        {
          exerciseId: "ex-2",
          exerciseName: "Incline DB Press",
          sets: [createSet()],
        },
        { exerciseId: "ex-3", exerciseName: "Cable Fly", sets: [createSet()] },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedExercises).toHaveLength(3);
    expect(insertedExercises[0].order_index).toBe(0);
    expect(insertedExercises[1].order_index).toBe(1);
    expect(insertedExercises[2].order_index).toBe(2);
  });

  it("rolls back workout when session save fails (transaction)", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    mockTransaction.mockRejectedValue(new Error("DB constraint violation"));

    await expect(
      createWorkoutFromGeneration(createGeneratedWorkout(), "conv-1"),
    ).rejects.toThrow();

    // Conversation should not be linked since the transaction failed
    expect(mockLinkConversation).not.toHaveBeenCalled();
  });

  it("handles negative targetWeight by setting weight to null", async () => {
    const exercises = [createExercise()];
    mockListAll.mockReturnValue(
      ResultAsync.fromSafePromise(Promise.resolve(exercises)),
    );

    const insertedSets: Record<string, unknown>[] = [];
    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      const tx = createMockTx((val) => {
        if ("name" in val && "start" in val) {
          return { returning: vi.fn().mockResolvedValue([{ id: "w-1" }]) };
        }
        if ("workout" in val && "exercise" in val && "set" in val) {
          insertedSets.push(val);
        }
        return Promise.resolve();
      });
      return fn(tx);
    });

    const workout = createGeneratedWorkout({
      exercises: [
        {
          exerciseId: "exercise-1",
          exerciseName: "Bench Press",
          sets: [createSet({ targetWeight: -5 })],
        },
      ],
    });

    await createWorkoutFromGeneration(workout, "conv-1");

    expect(insertedSets[0].weight).toBeNull();
  });
});
