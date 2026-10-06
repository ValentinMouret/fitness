import { beforeEach, describe, expect, it, vi } from "vitest";
import { userIdSchema } from "~/modules/auth/domain/user";

/**
 * Tests for workout session service input validation.
 * These test the pure validation logic without database dependencies.
 */

// Mock the repositories to avoid database dependencies
vi.mock("~/modules/fitness/infra/workout.repository.server", () => {
  const commands = { updateSet: vi.fn() };
  return {
    createWorkoutCommands: () => commands,
    createWorkoutRepository: () => ({}),
    createWorkoutSessionRepository: () => ({}),
  };
});

vi.mock("~/modules/fitness/infra/repository.server", () => ({
  createExerciseRepository: () => ({ listAll: vi.fn() }),
}));

vi.mock("~/logger.server", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { createWorkoutCommands } from "./workout.repository.server";
import {
  reorderExercisesInWorkout,
  replaceExerciseInWorkout,
  updateSetInWorkout,
} from "./workout-session.service.server";

const actor = userIdSchema.parse("8d1606c7-f8ee-487e-ae60-f326dd91b3bb");
const workoutCommands = createWorkoutCommands(actor);

describe("workout form boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { repsStr: "10garbage" },
    { repsStr: "1.5" },
    { weightStr: "20kg" },
    { weightStr: "Infinity" },
    { setNumberStr: "1.5" },
    { isCompletedStr: "maybe" },
    { reportedRirStr: "5" },
    { exerciseId: "invalid-id" },
  ])(
    "rejects malformed input before application operations: %j",
    async (input) => {
      const result = await updateSetInWorkout(actor, {
        workoutId: "3a12b433-0e67-4c6a-a7c3-38a4b32b955d",
        exerciseId: "62b242cd-862f-4f47-9d88-68bbfb488727",
        setNumberStr: "1",
        ...input,
      });
      expect(result).toHaveProperty("error");
      expect(workoutCommands.updateSet).not.toHaveBeenCalled();
    },
  );
});

describe("replaceExerciseInWorkout", () => {
  it("returns error when oldExerciseId is missing", async () => {
    const result = await replaceExerciseInWorkout(actor, {
      workoutId: "w-1",
      newExerciseId: "ex-2",
    });
    expect(result).toEqual({
      error: "Both old and new exercise IDs are required",
    });
  });

  it("returns error when newExerciseId is missing", async () => {
    const result = await replaceExerciseInWorkout(actor, {
      workoutId: "w-1",
      oldExerciseId: "ex-1",
    });
    expect(result).toEqual({
      error: "Both old and new exercise IDs are required",
    });
  });

  it("returns error when both exercise IDs are missing", async () => {
    const result = await replaceExerciseInWorkout(actor, {
      workoutId: "w-1",
    });
    expect(result).toEqual({
      error: "Both old and new exercise IDs are required",
    });
  });
});

describe("reorderExercisesInWorkout", () => {
  it("returns error when exerciseIds is empty", async () => {
    const result = await reorderExercisesInWorkout(actor, {
      workoutId: "w-1",
      exerciseIds: [],
    });
    expect(result).toEqual({ error: "Exercise IDs are required" });
  });
});
