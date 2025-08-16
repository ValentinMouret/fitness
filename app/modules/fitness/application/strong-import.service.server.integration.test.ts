import { describe, it, expect, afterEach } from "vitest";
import { importWorkout } from "./strong-import.service.server";
import { WorkoutSessionRepository } from "../infra/workout.repository.server";
import {
  STRONG_EXPORT_COMMA_DECIMALS_FAILURE,
  STRONG_EXPORT_BODYWEIGHT_REPS_ONLY,
} from "../domain/strong-import.fixtures";
import { db } from "~/db";
import {
  workouts,
  workoutSets,
  exercises,
  workoutExercises,
} from "~/db/schema";
import { eq } from "drizzle-orm";

describe("StrongImportService Integration Tests", () => {
  let createdWorkoutId: string | null = null;
  let createdExerciseIds: string[] = [];

  afterEach(async () => {
    // Clean up created data
    if (createdWorkoutId) {
      await db
        .delete(workoutSets)
        .where(eq(workoutSets.workout, createdWorkoutId));
      await db
        .delete(workoutExercises)
        .where(eq(workoutExercises.workout_id, createdWorkoutId));
      await db.delete(workouts).where(eq(workouts.id, createdWorkoutId));
      createdWorkoutId = null;
    }

    for (const exerciseId of createdExerciseIds) {
      await db.delete(exercises).where(eq(exercises.id, exerciseId));
    }
    createdExerciseIds = [];
  });

  describe("Complete import pipeline with warm-up sets", () => {
    it("should import workout with warm-up sets and display them correctly", async () => {
      // Test the exact workout data that the user provided
      const strongText = STRONG_EXPORT_COMMA_DECIMALS_FAILURE;

      console.log("=== STARTING INTEGRATION TEST ===");
      console.log("Importing Strong workout...");

      // Step 1: Import the workout
      const importResult = await importWorkout(strongText, {
        createMissingExercises: true,
        skipUnmappedExercises: false,
      });

      expect(importResult.isOk()).toBe(true);
      if (importResult.isErr()) {
        console.error("Import failed:", importResult.error);
        return;
      }

      const importData = importResult.value;
      createdWorkoutId = importData.workoutId;
      createdExerciseIds = [...importData.exercisesCreated];

      console.log("Import completed:", {
        workoutId: importData.workoutId,
        exercisesCreated: importData.exercisesCreated.length,
        warnings: importData.warnings,
      });

      // Step 2: Retrieve the workout session from database
      console.log("Retrieving workout session from database...");
      const workoutSessionResult = await WorkoutSessionRepository.findById(
        importData.workoutId,
      );

      expect(workoutSessionResult.isOk()).toBe(true);
      if (workoutSessionResult.isErr()) {
        console.error(
          "Failed to retrieve workout session:",
          workoutSessionResult.error,
        );
        return;
      }

      const workoutSession = workoutSessionResult.value;
      expect(workoutSession).not.toBeNull();
      if (!workoutSession) return;

      console.log("Retrieved workout session:", {
        workoutName: workoutSession.workout.name,
        exerciseCount: workoutSession.exerciseGroups.length,
      });

      // Step 3: Verify the imported data structure
      expect(workoutSession.workout.name).toBe("Early Morning Workout");
      expect(workoutSession.exerciseGroups).toHaveLength(3);

      // Step 4: Check Incline Bench Press (should have 3 warm-ups + 3 failure sets)
      const inclineBench = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Incline Bench Press"),
      );
      expect(inclineBench).toBeDefined();
      if (!inclineBench) return;

      console.log("Incline Bench Press sets:", {
        totalSets: inclineBench.sets.length,
        sets: inclineBench.sets.map((set) => ({
          setNumber: set.set,
          isWarmup: set.isWarmup,
          isFailure: set.isFailure,
          weight: set.weight,
          reps: set.reps,
        })),
      });

      // Should have 6 sets total (3 warm-ups + 3 working sets)
      expect(inclineBench.sets).toHaveLength(6);

      // Verify warm-up sets
      const warmupSets = inclineBench.sets.filter((set) => set.isWarmup);
      const workingSets = inclineBench.sets.filter((set) => !set.isWarmup);

      console.log("Warm-up sets found:", warmupSets.length);
      console.log("Working sets found:", workingSets.length);

      expect(warmupSets).toHaveLength(3);
      expect(workingSets).toHaveLength(3);

      // Verify warm-up set details
      expect(warmupSets[0]).toMatchObject({
        weight: 20,
        reps: 8,
        isWarmup: true,
        isFailure: false,
      });

      expect(warmupSets[1]).toMatchObject({
        weight: 40,
        reps: 8,
        isWarmup: true,
        isFailure: false,
      });

      expect(warmupSets[2]).toMatchObject({
        weight: 60,
        reps: 3,
        isWarmup: true,
        isFailure: false,
      });

      // Verify working sets (failure sets)
      for (const workingSet of workingSets) {
        expect(workingSet.isWarmup).toBe(false);
        expect(workingSet.isFailure).toBe(true);
        expect(workingSet.weight).toBe(62.5);
      }

      // Step 5: Check Iso-Lateral Row (should have 3 warm-ups + 3 regular sets)
      const isoRow = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Iso-Lateral Row"),
      );
      expect(isoRow).toBeDefined();
      if (!isoRow) return;

      console.log("Iso-Lateral Row sets:", {
        totalSets: isoRow.sets.length,
        sets: isoRow.sets.map((set) => ({
          setNumber: set.set,
          isWarmup: set.isWarmup,
          isFailure: set.isFailure,
          weight: set.weight,
          reps: set.reps,
        })),
      });

      expect(isoRow.sets).toHaveLength(6);

      const isoWarmupSets = isoRow.sets.filter((set) => set.isWarmup);
      const isoWorkingSets = isoRow.sets.filter((set) => !set.isWarmup);

      expect(isoWarmupSets).toHaveLength(3);
      expect(isoWorkingSets).toHaveLength(3);

      // Verify all working sets are regular (not failure)
      for (const workingSet of isoWorkingSets) {
        expect(workingSet.isWarmup).toBe(false);
        expect(workingSet.isFailure).toBe(false);
      }

      // Step 6: Check Squat (should have 2 warm-ups + 2 regular sets)
      const squat = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Squat"),
      );
      expect(squat).toBeDefined();
      if (!squat) return;

      console.log("Squat sets:", {
        totalSets: squat.sets.length,
        sets: squat.sets.map((set) => ({
          setNumber: set.set,
          isWarmup: set.isWarmup,
          isFailure: set.isFailure,
          weight: set.weight,
          reps: set.reps,
        })),
      });

      expect(squat.sets).toHaveLength(4);

      const squatWarmupSets = squat.sets.filter((set) => set.isWarmup);
      const squatWorkingSets = squat.sets.filter((set) => !set.isWarmup);

      expect(squatWarmupSets).toHaveLength(2);
      expect(squatWorkingSets).toHaveLength(2);

      console.log("=== INTEGRATION TEST COMPLETED SUCCESSFULLY ===");
    });

    it("should handle set number conflicts properly", async () => {
      // This test will help us understand if there are set number conflicts
      // between warm-up sets (W1, W2, W3) and regular sets (Set 1, Set 2, Set 3)

      console.log("=== TESTING SET NUMBER CONFLICTS ===");

      const strongText = STRONG_EXPORT_COMMA_DECIMALS_FAILURE;
      const importResult = await importWorkout(strongText, {
        createMissingExercises: true,
        skipUnmappedExercises: false,
      });

      expect(importResult.isOk()).toBe(true);
      if (importResult.isErr()) return;

      createdWorkoutId = importResult.value.workoutId;
      createdExerciseIds = [...importResult.value.exercisesCreated];

      // Query database directly to see actual set numbers stored
      const dbSets = await db
        .select({
          exerciseId: workoutSets.exercise,
          setNumber: workoutSets.set,
          isWarmup: workoutSets.isWarmup,
          isFailure: workoutSets.isFailure,
          weight: workoutSets.weight,
          reps: workoutSets.reps,
        })
        .from(workoutSets)
        .where(eq(workoutSets.workout, createdWorkoutId))
        .orderBy(workoutSets.exercise, workoutSets.set);

      console.log("Database sets by exercise:");
      const setsByExercise = new Map<string, Array<(typeof dbSets)[0]>>();
      for (const set of dbSets) {
        if (!setsByExercise.has(set.exerciseId)) {
          setsByExercise.set(set.exerciseId, []);
        }
        setsByExercise.get(set.exerciseId)?.push(set);
      }

      for (const [exerciseId, sets] of setsByExercise) {
        console.log(`Exercise ${exerciseId}:`, sets);

        // Check for duplicate set numbers
        const setNumbers = sets.map((s) => s.setNumber);
        const uniqueSetNumbers = new Set(setNumbers);

        if (setNumbers.length !== uniqueSetNumbers.size) {
          console.error("FOUND DUPLICATE SET NUMBERS!", setNumbers);
        }

        expect(setNumbers.length).toBe(uniqueSetNumbers.size);
      }
    });
  });

  describe("Bodyweight exercises with reps-only format", () => {
    it("should import bodyweight exercises with 'Set X: Y reps' format", async () => {
      console.log("=== TESTING BODYWEIGHT REPS-ONLY FORMAT ===");

      const strongText = STRONG_EXPORT_BODYWEIGHT_REPS_ONLY;

      // Step 1: Import the workout
      const importResult = await importWorkout(strongText, {
        createMissingExercises: true,
        skipUnmappedExercises: false,
      });

      expect(importResult.isOk()).toBe(true);
      if (importResult.isErr()) {
        console.error("Import failed:", importResult.error);
        return;
      }

      const importData = importResult.value;
      createdWorkoutId = importData.workoutId;
      createdExerciseIds = [...importData.exercisesCreated];

      console.log("Bodyweight import completed:", {
        workoutId: importData.workoutId,
        exercisesCreated: importData.exercisesCreated.length,
        warnings: importData.warnings,
      });

      // Step 2: Retrieve the workout session from database
      const workoutSessionResult = await WorkoutSessionRepository.findById(
        importData.workoutId,
      );

      expect(workoutSessionResult.isOk()).toBe(true);
      if (workoutSessionResult.isErr()) {
        console.error(
          "Failed to retrieve workout session:",
          workoutSessionResult.error,
        );
        return;
      }

      const workoutSession = workoutSessionResult.value;
      expect(workoutSession).not.toBeNull();
      if (!workoutSession) return;

      // Step 3: Verify the imported data structure
      expect(workoutSession.workout.name).toBe("Morning Workout");
      expect(workoutSession.exerciseGroups).toHaveLength(3);

      // Debug: Log all exercise names
      console.log(
        "Exercise names found:",
        workoutSession.exerciseGroups.map((g) => g.exercise.name),
      );

      // Step 4: Check each exercise has the correct bodyweight sets
      const chestDip = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Chest Dip"),
      );
      expect(chestDip).toBeDefined();
      if (!chestDip) return;

      expect(chestDip.sets).toHaveLength(3);
      expect(chestDip.sets[0]).toMatchObject({
        weight: undefined, // Bodyweight exercises should have weight = undefined
        reps: 10,
        isWarmup: false,
        isFailure: false,
      });
      expect(chestDip.sets[1]).toMatchObject({
        weight: undefined,
        reps: 10,
        isWarmup: false,
        isFailure: false,
      });
      expect(chestDip.sets[2]).toMatchObject({
        weight: undefined,
        reps: 8,
        isWarmup: false,
        isFailure: false,
      });

      const squatBodyweight = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Squat"),
      );
      expect(squatBodyweight).toBeDefined();
      if (!squatBodyweight) return;

      expect(squatBodyweight.sets).toHaveLength(3);
      expect(squatBodyweight.sets[0]).toMatchObject({
        weight: undefined,
        reps: 15,
        isWarmup: false,
        isFailure: false,
      });

      const pullUp = workoutSession.exerciseGroups.find((group) =>
        group.exercise.name.includes("Pull Up"),
      );
      expect(pullUp).toBeDefined();
      if (!pullUp) return;

      expect(pullUp.sets).toHaveLength(3);
      expect(pullUp.sets[0]).toMatchObject({
        weight: undefined,
        reps: 10,
        isWarmup: false,
        isFailure: false,
      });
      expect(pullUp.sets[1]).toMatchObject({
        weight: undefined,
        reps: 9,
        isWarmup: false,
        isFailure: false,
      });
      expect(pullUp.sets[2]).toMatchObject({
        weight: undefined,
        reps: 7,
        isWarmup: false,
        isFailure: false,
      });

      console.log("=== BODYWEIGHT FORMAT TEST COMPLETED SUCCESSFULLY ===");
    });
  });
});
