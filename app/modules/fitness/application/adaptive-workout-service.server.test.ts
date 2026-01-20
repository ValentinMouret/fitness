import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultAsync } from "neverthrow";
import { AdaptiveWorkoutService } from "./adaptive-workout-service.server";
import type {
  AdaptiveWorkoutRequest,
  ExerciseMuscleGroups,
  Exercise,
  EquipmentInstance,
  MuscleGroup,
} from "~/modules/fitness/domain/workout";

// Create mock functions
const mockExerciseMuscleGroupsListAll = vi.fn();
const mockAdaptiveWorkoutFindSubstitutes = vi.fn();

// Mock dependencies
vi.mock("~/modules/fitness/infra/repository.server", () => ({
  ExerciseMuscleGroupsRepository: {
    listAll: mockExerciseMuscleGroupsListAll,
  },
}));

vi.mock("~/modules/fitness/infra/adaptive-workout-repository.server", () => ({
  AdaptiveWorkoutRepository: {
    findSubstitutes: mockAdaptiveWorkoutFindSubstitutes,
  },
}));

// Test data helpers
const createExercise = (overrides?: Partial<Exercise>): Exercise => ({
  id: "exercise-1",
  name: "Test Exercise",
  type: "dumbbells",
  movementPattern: "push",
  ...overrides,
});

const createExerciseMuscleGroups = (
  exercise?: Partial<Exercise>,
  muscleGroups?: MuscleGroup[],
): ExerciseMuscleGroups => ({
  exercise: createExercise(exercise),
  muscleGroupSplits: (muscleGroups || ["pecs"]).map((muscleGroup) => ({
    muscleGroup,
    split: 0.5,
  })),
});

const createEquipmentInstance = (
  overrides?: Partial<EquipmentInstance>,
): EquipmentInstance => ({
  id: "equipment-1",
  name: "Test Equipment",
  exerciseType: "dumbbells",
  isAvailable: true,
  gymFloorId: "floor-1",
  capacity: 1,
  ...overrides,
});

const createAdaptiveWorkoutRequest = (
  overrides?: Partial<AdaptiveWorkoutRequest>,
): AdaptiveWorkoutRequest => ({
  targetDuration: 60,
  availableEquipment: [createEquipmentInstance()],
  volumeNeeds: new Map<MuscleGroup, number>([["pecs", 5]]),
  ...overrides,
});

describe("AdaptiveWorkoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateWorkout", () => {
    it("should generate a workout successfully with available exercises", async () => {
      const mockExercises = [
        createExerciseMuscleGroups({
          type: "dumbbells",
          movementPattern: "push",
        }),
        createExerciseMuscleGroups(
          {
            id: "exercise-2",
            type: "dumbbells",
            movementPattern: "pull",
          },
          ["lats"],
        ),
        createExerciseMuscleGroups(
          {
            id: "exercise-3",
            type: "dumbbells",
            movementPattern: "squat",
          },
          ["quads"],
        ),
      ];

      mockExerciseMuscleGroupsListAll.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockExercises)),
      );

      const request = createAdaptiveWorkoutRequest({ targetDuration: 60 });
      const result = await AdaptiveWorkoutService.generateWorkout(request);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.workout.exerciseGroups).toHaveLength(3);
        expect(result.value.estimatedDuration).toBe(24); // 3 exercises * 8 min
        expect(result.value.floorSwitches).toBe(0); // All same floor
        expect(result.value.alternatives).toBeDefined();
      }
    });

    it("should return no_available_equipment error when no exercises match equipment", async () => {
      const mockExercises = [
        createExerciseMuscleGroups({ type: "barbell" }), // Different equipment type
      ];

      mockExerciseMuscleGroupsListAll.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockExercises)),
      );

      const request = createAdaptiveWorkoutRequest({
        availableEquipment: [
          createEquipmentInstance({ exerciseType: "dumbbells" }),
        ],
      });

      const result = await AdaptiveWorkoutService.generateWorkout(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("no_available_equipment");
      }
    });

    it("should return insufficient_exercises error when not enough exercises available", async () => {
      const mockExercises = [
        createExerciseMuscleGroups({ type: "dumbbells" }),
        createExerciseMuscleGroups({ id: "exercise-2", type: "dumbbells" }),
      ];

      mockExerciseMuscleGroupsListAll.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockExercises)),
      );

      const request = createAdaptiveWorkoutRequest({ targetDuration: 120 }); // Would need more exercises

      const result = await AdaptiveWorkoutService.generateWorkout(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("insufficient_exercises");
      }
    });

    it("should handle repository errors", async () => {
      mockExerciseMuscleGroupsListAll.mockReturnValue(
        ResultAsync.fromPromise(
          Promise.reject("database_error"),
          (error) => error as "database_error",
        ),
      );

      const request = createAdaptiveWorkoutRequest();
      const result = await AdaptiveWorkoutService.generateWorkout(request);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("database_error");
      }
    });
  });

  describe("replaceExercise", () => {
    it("should replace exercise with suitable substitute", async () => {
      const mockSubstitutes = [
        createExerciseMuscleGroups({ id: "substitute-1", type: "dumbbells" }),
        createExerciseMuscleGroups({ id: "substitute-2", type: "dumbbells" }),
      ];

      mockAdaptiveWorkoutFindSubstitutes.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockSubstitutes)),
      );

      const availableEquipment = [
        createEquipmentInstance({ exerciseType: "dumbbells" }),
      ];
      const result = await AdaptiveWorkoutService.replaceExercise(
        "workout-1",
        "exercise-1",
        availableEquipment,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBeDefined();
        expect(["substitute-1", "substitute-2"]).toContain(result.value.id);
      }
    });

    it("should return no_suitable_substitutes error when no substitutes found", async () => {
      mockAdaptiveWorkoutFindSubstitutes.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve([])),
      );

      const availableEquipment = [createEquipmentInstance()];
      const result = await AdaptiveWorkoutService.replaceExercise(
        "workout-1",
        "exercise-1",
        availableEquipment,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("no_suitable_substitutes");
      }
    });

    it("should return equipment_unavailable error when substitutes need unavailable equipment", async () => {
      const mockSubstitutes = [
        createExerciseMuscleGroups({ type: "barbell" }), // Different equipment type
      ];

      mockAdaptiveWorkoutFindSubstitutes.mockReturnValue(
        ResultAsync.fromSafePromise(Promise.resolve(mockSubstitutes)),
      );

      const availableEquipment = [
        createEquipmentInstance({ exerciseType: "dumbbells" }),
      ];
      const result = await AdaptiveWorkoutService.replaceExercise(
        "workout-1",
        "exercise-1",
        availableEquipment,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("equipment_unavailable");
      }
    });
  });

  describe("filterByAvailableEquipment", () => {
    it("should filter exercises by available equipment", () => {
      const exercises = [
        createExerciseMuscleGroups({ type: "dumbbells" }),
        createExerciseMuscleGroups({ type: "barbell" }),
        createExerciseMuscleGroups({ type: "cable" }),
      ];

      const availableEquipment = [
        createEquipmentInstance({
          exerciseType: "dumbbells",
          isAvailable: true,
        }),
        createEquipmentInstance({
          exerciseType: "barbell",
          isAvailable: false,
        }),
        createEquipmentInstance({ exerciseType: "cable", isAvailable: true }),
      ];

      const filtered = AdaptiveWorkoutService.filterByAvailableEquipment(
        exercises,
        availableEquipment,
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((e) => e.exercise.type)).toEqual([
        "dumbbells",
        "cable",
      ]);
    });

    it("should return empty array when no equipment is available", () => {
      const exercises = [createExerciseMuscleGroups({ type: "dumbbells" })];
      const availableEquipment = [
        createEquipmentInstance({
          exerciseType: "dumbbells",
          isAvailable: false,
        }),
      ];

      const filtered = AdaptiveWorkoutService.filterByAvailableEquipment(
        exercises,
        availableEquipment,
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe("selectOptimalExercises", () => {
    it("should select exercises up to target duration", () => {
      const exercises = Array.from({ length: 10 }, (_, i) =>
        createExerciseMuscleGroups({
          id: `exercise-${i}`,
          movementPattern: i % 2 === 0 ? "push" : "pull",
        }),
      );

      const request = createAdaptiveWorkoutRequest({ targetDuration: 40 }); // 5 exercises max

      const result = AdaptiveWorkoutService.selectOptimalExercises(
        exercises,
        request,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBeLessThanOrEqual(5);
        expect(result.value.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should return insufficient_exercises error when less than 3 exercises selected", () => {
      const exercises = [
        createExerciseMuscleGroups({ id: "exercise-1" }),
        createExerciseMuscleGroups({ id: "exercise-2" }),
      ];

      const request = createAdaptiveWorkoutRequest({ targetDuration: 120 });

      const result = AdaptiveWorkoutService.selectOptimalExercises(
        exercises,
        request,
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe("insufficient_exercises");
      }
    });

    it("should prioritize exercises based on volume needs", () => {
      const exercises = [
        createExerciseMuscleGroups({ id: "pecs-exercise" }, ["pecs"]),
        createExerciseMuscleGroups({ id: "lats-exercise" }, ["lats"]),
        createExerciseMuscleGroups({ id: "quads-exercise" }, ["quads"]),
      ];

      const request = createAdaptiveWorkoutRequest({
        targetDuration: 32, // 4 exercises max
        volumeNeeds: new Map<MuscleGroup, number>([
          ["pecs", 10], // High priority
          ["lats", 5],
          ["quads", 2],
        ]),
      });

      const result = AdaptiveWorkoutService.selectOptimalExercises(
        exercises,
        request,
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Should include pecs exercise due to high volume need
        const selectedIds = result.value.map((e) => e.exercise.id);
        expect(selectedIds).toContain("pecs-exercise");
      }
    });
  });

  describe("calculateFloorSwitches", () => {
    it("should count floor switches correctly", () => {
      const exercises = [
        createExerciseMuscleGroups({ type: "dumbbells" }),
        createExerciseMuscleGroups({ type: "cable" }),
        createExerciseMuscleGroups({ type: "machine" }),
      ];

      const availableEquipment = [
        createEquipmentInstance({
          exerciseType: "dumbbells",
          gymFloorId: "floor-1",
        }),
        createEquipmentInstance({
          exerciseType: "cable",
          gymFloorId: "floor-2",
        }),
        createEquipmentInstance({
          exerciseType: "machine",
          gymFloorId: "floor-1",
        }),
      ];

      const switches = AdaptiveWorkoutService.calculateFloorSwitches(
        exercises,
        availableEquipment,
      );

      expect(switches).toBe(2); // floor-1 -> floor-2 -> floor-1
    });

    it("should return 0 switches when all equipment on same floor", () => {
      const exercises = [
        createExerciseMuscleGroups({ type: "dumbbells" }),
        createExerciseMuscleGroups({ type: "cable" }),
      ];

      const availableEquipment = [
        createEquipmentInstance({
          exerciseType: "dumbbells",
          gymFloorId: "floor-1",
        }),
        createEquipmentInstance({
          exerciseType: "cable",
          gymFloorId: "floor-1",
        }),
      ];

      const switches = AdaptiveWorkoutService.calculateFloorSwitches(
        exercises,
        availableEquipment,
      );

      expect(switches).toBe(0);
    });
  });

  describe("estimateDuration", () => {
    it("should estimate 8 minutes per exercise", () => {
      const exercises = [
        createExerciseMuscleGroups(),
        createExerciseMuscleGroups(),
        createExerciseMuscleGroups(),
      ];

      const duration = AdaptiveWorkoutService.estimateDuration(exercises);

      expect(duration).toBe(24); // 3 exercises * 8 minutes
    });

    it("should return 0 for empty exercise list", () => {
      const duration = AdaptiveWorkoutService.estimateDuration([]);
      expect(duration).toBe(0);
    });
  });

  describe("generateAlternatives", () => {
    it("should generate alternatives for each selected exercise", () => {
      const selectedExercises = [
        createExerciseMuscleGroups({
          id: "selected-1",
          movementPattern: "push",
        }),
      ];

      const availableExercises = [
        ...selectedExercises,
        createExerciseMuscleGroups({
          id: "alt-1",
          movementPattern: "push",
        }),
        createExerciseMuscleGroups({
          id: "alt-2",
          movementPattern: "push",
        }),
        createExerciseMuscleGroups({
          id: "different-pattern",
          movementPattern: "pull",
        }),
      ];

      const alternatives = AdaptiveWorkoutService.generateAlternatives(
        selectedExercises,
        availableExercises,
      );

      expect(alternatives.has("selected-1")).toBe(true);
      const alts = alternatives.get("selected-1");
      expect(alts).toHaveLength(2);
      expect(alts?.map((e) => e.id)).toEqual(["alt-1", "alt-2"]);
    });

    it("should limit alternatives to 3 per exercise", () => {
      const selectedExercises = [
        createExerciseMuscleGroups({
          id: "selected-1",
          movementPattern: "push",
        }),
      ];

      const availableExercises = [
        ...selectedExercises,
        ...Array.from({ length: 5 }, (_, i) =>
          createExerciseMuscleGroups({
            id: `alt-${i}`,
            movementPattern: "push",
          }),
        ),
      ];

      const alternatives = AdaptiveWorkoutService.generateAlternatives(
        selectedExercises,
        availableExercises,
      );

      const alts = alternatives.get("selected-1");
      expect(alts).toHaveLength(3);
    });
  });

  describe("scoreExercise", () => {
    it("should score exercises based on priority muscle groups", () => {
      const highPriorityExercise = createExerciseMuscleGroups(
        { type: "dumbbells" },
        ["pecs"],
      );
      const lowPriorityExercise = createExerciseMuscleGroups(
        { type: "dumbbells" },
        ["calves"],
      );

      const priorityMuscleGroups: MuscleGroup[] = ["pecs", "lats", "quads"];
      const equipmentPreferences = new Map([["dumbbells", 3]]);
      const availableEquipment = [
        createEquipmentInstance({ exerciseType: "dumbbells" }),
      ];

      const highScore = AdaptiveWorkoutService.scoreExercise(
        highPriorityExercise,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );

      const lowScore = AdaptiveWorkoutService.scoreExercise(
        lowPriorityExercise,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it("should give bonus for equipment preferences", () => {
      const cableExercise = createExerciseMuscleGroups({ type: "cable" });
      const machineExercise = createExerciseMuscleGroups({ type: "machine" });

      const priorityMuscleGroups: MuscleGroup[] = [];
      const equipmentPreferences =
        AdaptiveWorkoutService.getEquipmentPreferences();
      const availableEquipment = [
        createEquipmentInstance({ exerciseType: "cable" }),
        createEquipmentInstance({ exerciseType: "machine" }),
      ];

      const cableScore = AdaptiveWorkoutService.scoreExercise(
        cableExercise,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );

      const machineScore = AdaptiveWorkoutService.scoreExercise(
        machineExercise,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );

      expect(cableScore).toBeGreaterThan(machineScore); // Cables preferred over machines
    });
  });

  describe("getEquipmentPreferences", () => {
    it("should return expected equipment preferences", () => {
      const preferences = AdaptiveWorkoutService.getEquipmentPreferences();

      expect(preferences.get("cable")).toBe(4);
      expect(preferences.get("dumbbells")).toBe(3);
      expect(preferences.get("bodyweight")).toBe(3);
      expect(preferences.get("barbell")).toBe(2);
      expect(preferences.get("machine")).toBe(1);
    });
  });
});
