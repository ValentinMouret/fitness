import { describe, it, expect } from "vitest";
import { createWorkoutExerciseCardViewModel } from "./workout-exercise-card.view-model";
import type {
  WorkoutExerciseGroup,
  Exercise,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";

describe("WorkoutExerciseCardViewModel", () => {
  const mockExercise: Exercise = {
    id: "ex-1",
    name: "Bench Press",
    type: "barbell",
    movementPattern: "push",
    mmcInstructions: "Squeeze chest at the top, feel the stretch at the bottom",
  };

  const mockSets: WorkoutSet[] = [
    {
      workoutId: "w-1",
      exerciseId: "ex-1",
      set: 1,
      reps: 10,
      weight: 80,
      note: "Warm up",
      isCompleted: true,
      isFailure: false,
      isWarmup: true,
    },
    {
      workoutId: "w-1",
      exerciseId: "ex-1",
      set: 2,
      reps: 8,
      weight: 90,
      note: "",
      isCompleted: true,
      isFailure: false,
      isWarmup: false,
    },
    {
      workoutId: "w-1",
      exerciseId: "ex-1",
      set: 3,
      reps: 6,
      weight: 100,
      note: undefined,
      isCompleted: false,
      isFailure: false,
      isWarmup: false,
    },
  ];

  const mockExerciseGroup: WorkoutExerciseGroup = {
    exercise: mockExercise,
    sets: mockSets,
    notes: "Focus on form",
    orderIndex: 0,
  };

  describe("createWorkoutExerciseCardViewModel", () => {
    it("should create view model with correct basic properties", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      expect(viewModel.exerciseId).toBe("ex-1");
      expect(viewModel.exerciseName).toBe("Bench Press");
      expect(viewModel.exerciseType).toBe("barbell");
      expect(viewModel.notes).toBe("Focus on form");
      expect(viewModel.mmcInstructions).toBe(
        "Squeeze chest at the top, feel the stretch at the bottom",
      );
    });

    it("should calculate total volume display correctly", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      // Only completed sets: (10 * 80) + (8 * 90) = 800 + 720 = 1520 kg
      expect(viewModel.totalVolumeDisplay).toBe("1520 kg");
    });

    it("should return empty total volume when no completed sets", () => {
      const setsWithoutCompleted = mockSets.map((set) => ({
        ...set,
        isCompleted: false,
      }));
      const exerciseGroup = {
        ...mockExerciseGroup,
        sets: setsWithoutCompleted,
      };

      const viewModel = createWorkoutExerciseCardViewModel(
        exerciseGroup,
        false,
      );

      expect(viewModel.totalVolumeDisplay).toBe("");
    });

    it("should transform sets to view models correctly", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      expect(viewModel.sets).toHaveLength(3);

      const firstSet = viewModel.sets[0];
      expect(firstSet.set).toBe(1);
      expect(firstSet.reps).toBe(10);
      expect(firstSet.weight).toBe(80);
      expect(firstSet.note).toBe("Warm up");
      expect(firstSet.isCompleted).toBe(true);
      expect(firstSet.repsDisplay).toBe("10");
      expect(firstSet.weightDisplay).toBe("80");
      expect(firstSet.noteDisplay).toBe("Warm up");
    });

    it("should handle undefined/null set values correctly", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      const thirdSet = viewModel.sets[2];
      expect(thirdSet.noteDisplay).toBe("—");
    });

    it("should set correct permissions when workout is not complete", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      expect(viewModel.canAddSets).toBe(true);
      expect(viewModel.canRemoveExercise).toBe(true);
    });

    it("should set correct permissions when workout is complete", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        true,
      );

      expect(viewModel.canAddSets).toBe(false);
      expect(viewModel.canRemoveExercise).toBe(false);
    });

    it("should identify when there are completed sets", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      expect(viewModel.hasCompletedSets).toBe(true);
    });

    it("should identify when there are no completed sets", () => {
      const setsWithoutCompleted = mockSets.map((set) => ({
        ...set,
        isCompleted: false,
      }));
      const exerciseGroup = {
        ...mockExerciseGroup,
        sets: setsWithoutCompleted,
      };

      const viewModel = createWorkoutExerciseCardViewModel(
        exerciseGroup,
        false,
      );

      expect(viewModel.hasCompletedSets).toBe(false);
    });

    it("should set lastSet correctly", () => {
      const viewModel = createWorkoutExerciseCardViewModel(
        mockExerciseGroup,
        false,
      );

      expect(viewModel.lastSet?.set).toBe(3);
      expect(viewModel.lastSet?.reps).toBe(6);
      expect(viewModel.lastSet?.weight).toBe(100);
    });

    it("should handle empty sets array", () => {
      const exerciseGroup = { ...mockExerciseGroup, sets: [] };

      const viewModel = createWorkoutExerciseCardViewModel(
        exerciseGroup,
        false,
      );

      expect(viewModel.sets).toHaveLength(0);
      expect(viewModel.lastSet).toBeUndefined();
      expect(viewModel.hasCompletedSets).toBe(false);
      expect(viewModel.totalVolumeDisplay).toBe("");
    });
  });
});
