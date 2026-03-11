import { and, eq, isNull } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/db";
import {
  exerciseMuscleGroups,
  exercises,
  generationConversations,
  workoutExercises,
  workoutSets,
  workouts,
} from "~/db/schema";
import type { GeneratedWorkout } from "~/modules/fitness/domain/ai-generation";
import { createWorkoutFromGeneration } from "./create-workout-from-generation.service.server";

function extractWorkoutId(response: Response): string {
  const location = response.headers.get("Location");
  if (!location) throw new Error("No Location header in redirect");
  return location.replace("/workouts/", "");
}

describe("createWorkoutFromGeneration Integration Tests", () => {
  const testExerciseIds: string[] = [];
  const createdWorkoutIds: string[] = [];
  let conversationId: string;

  beforeAll(async () => {
    // Create test exercises in the DB
    const testExercises = [
      {
        name: "Integration Test Bench Press",
        type: "barbell" as const,
        movement_pattern: "push" as const,
      },
      {
        name: "Integration Test Pull-up",
        type: "bodyweight" as const,
        movement_pattern: "pull" as const,
      },
      {
        name: "Integration Test Cable Fly",
        type: "cable" as const,
        movement_pattern: "isolation" as const,
      },
    ];

    for (const ex of testExercises) {
      const [record] = await db
        .insert(exercises)
        .values(ex)
        .returning({ id: exercises.id });
      testExerciseIds.push(record.id);
    }

    // Create a test conversation
    const [conv] = await db
      .insert(generationConversations)
      .values({
        messages: [],
        context_snapshot: {},
        model: "test-model",
        total_tokens: 0,
      })
      .returning({ id: generationConversations.id });
    conversationId = conv.id;
  });

  afterEach(async () => {
    // Clean up created workouts (but not test exercises, they stay for all tests)
    for (const workoutId of createdWorkoutIds) {
      await db.delete(workoutSets).where(eq(workoutSets.workout, workoutId));
      await db
        .delete(workoutExercises)
        .where(eq(workoutExercises.workout_id, workoutId));
      await db.delete(workouts).where(eq(workouts.id, workoutId));
    }
    createdWorkoutIds.length = 0;
  });

  afterAll(async () => {
    // Clean up test exercises and conversation
    for (const exerciseId of testExerciseIds) {
      await db
        .delete(exerciseMuscleGroups)
        .where(eq(exerciseMuscleGroups.exercise, exerciseId));
      await db.delete(exercises).where(eq(exercises.id, exerciseId));
    }
    await db
      .delete(generationConversations)
      .where(eq(generationConversations.id, conversationId));
  });

  it("creates a workout with exercises and sets in the database", async () => {
    const generated: GeneratedWorkout = {
      name: "Integration Test Push Day",
      rationale: "Testing",
      estimatedDuration: 45,
      exercises: [
        {
          exerciseId: testExerciseIds[0],
          exerciseName: "Integration Test Bench Press",
          notes: "Pause at bottom",
          sets: [
            {
              setNumber: 1,
              targetReps: 5,
              targetWeight: 40,
              isWarmup: true,
              restSeconds: 60,
            },
            {
              setNumber: 2,
              targetReps: 8,
              targetWeight: 80,
              isWarmup: false,
              restSeconds: 120,
            },
            {
              setNumber: 3,
              targetReps: 8,
              targetWeight: 80,
              isWarmup: false,
              restSeconds: 120,
            },
          ],
        },
        {
          exerciseId: testExerciseIds[2],
          exerciseName: "Integration Test Cable Fly",
          sets: [
            {
              setNumber: 1,
              targetReps: 12,
              targetWeight: 15,
              isWarmup: false,
              restSeconds: 90,
            },
          ],
        },
      ],
    };

    const response = await createWorkoutFromGeneration(
      generated,
      conversationId,
    );

    // Should redirect
    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toMatch(/^\/workouts\//);

    const workoutId = extractWorkoutId(response);
    createdWorkoutIds.push(workoutId);

    // Verify workout exists in DB
    const [workout] = await db
      .select()
      .from(workouts)
      .where(eq(workouts.id, workoutId));
    expect(workout).toBeDefined();
    expect(workout.name).toBe("Integration Test Push Day");
    expect(workout.stop).toBeNull();

    // Verify exercises
    const weRecords = await db
      .select()
      .from(workoutExercises)
      .where(
        and(
          eq(workoutExercises.workout_id, workoutId),
          isNull(workoutExercises.deleted_at),
        ),
      );
    expect(weRecords).toHaveLength(2);
    expect(
      weRecords.find((r) => r.exercise_id === testExerciseIds[0]),
    ).toBeDefined();
    expect(
      weRecords.find((r) => r.exercise_id === testExerciseIds[2]),
    ).toBeDefined();

    // Verify sets
    const setRecords = await db
      .select()
      .from(workoutSets)
      .where(
        and(eq(workoutSets.workout, workoutId), isNull(workoutSets.deleted_at)),
      );
    expect(setRecords).toHaveLength(4);

    // Verify warmup set
    const warmupSet = setRecords.find(
      (s) => s.exercise === testExerciseIds[0] && s.set === 1,
    );
    expect(warmupSet).toBeDefined();
    expect(warmupSet?.isWarmup).toBe(true);
    expect(warmupSet?.targetReps).toBe(5);
    expect(warmupSet?.weight).toBe(40);

    // Verify working set
    const workingSet = setRecords.find(
      (s) => s.exercise === testExerciseIds[0] && s.set === 2,
    );
    expect(workingSet).toBeDefined();
    expect(workingSet?.isWarmup).toBe(false);
    expect(workingSet?.targetReps).toBe(8);
    expect(workingSet?.weight).toBe(80);
    expect(workingSet?.isCompleted).toBe(false);
  });

  it("handles bodyweight exercises with zero weight", async () => {
    const generated: GeneratedWorkout = {
      name: "Integration Test Bodyweight",
      rationale: "Testing bodyweight",
      estimatedDuration: 30,
      exercises: [
        {
          exerciseId: testExerciseIds[1],
          exerciseName: "Integration Test Pull-up",
          sets: [
            {
              setNumber: 1,
              targetReps: 10,
              targetWeight: 0,
              isWarmup: false,
              restSeconds: 90,
            },
            {
              setNumber: 2,
              targetReps: 10,
              targetWeight: 0,
              isWarmup: false,
              restSeconds: 90,
            },
          ],
        },
      ],
    };

    const response = await createWorkoutFromGeneration(
      generated,
      conversationId,
    );

    expect(response.status).toBe(302);
    const workoutId = extractWorkoutId(response);
    createdWorkoutIds.push(workoutId);

    // Verify sets have NULL weight (not 0)
    const setRecords = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.workout, workoutId));

    expect(setRecords).toHaveLength(2);
    for (const set of setRecords) {
      expect(set.weight).toBeNull();
    }
  });

  it("skips exercises with invalid IDs", async () => {
    const generated: GeneratedWorkout = {
      name: "Integration Test Invalid Exercises",
      rationale: "Testing invalid exercise filtering",
      estimatedDuration: 30,
      exercises: [
        {
          exerciseId: "00000000-0000-0000-0000-000000000000",
          exerciseName: "Non-existent Exercise",
          sets: [
            {
              setNumber: 1,
              targetReps: 10,
              targetWeight: 50,
              isWarmup: false,
              restSeconds: 90,
            },
          ],
        },
        {
          exerciseId: testExerciseIds[0],
          exerciseName: "Integration Test Bench Press",
          sets: [
            {
              setNumber: 1,
              targetReps: 8,
              targetWeight: 60,
              isWarmup: false,
              restSeconds: 120,
            },
          ],
        },
      ],
    };

    const response = await createWorkoutFromGeneration(
      generated,
      conversationId,
    );

    expect(response.status).toBe(302);
    const workoutId = extractWorkoutId(response);
    createdWorkoutIds.push(workoutId);

    // Only the valid exercise should be saved
    const weRecords = await db
      .select()
      .from(workoutExercises)
      .where(
        and(
          eq(workoutExercises.workout_id, workoutId),
          isNull(workoutExercises.deleted_at),
        ),
      );
    expect(weRecords).toHaveLength(1);
    expect(weRecords[0].exercise_id).toBe(testExerciseIds[0]);
  });

  it("throws when all exercises are invalid", async () => {
    const generated: GeneratedWorkout = {
      name: "Integration Test All Invalid",
      rationale: "Testing total failure",
      estimatedDuration: 30,
      exercises: [
        {
          exerciseId: "00000000-0000-0000-0000-000000000001",
          exerciseName: "Fake Exercise 1",
          sets: [
            {
              setNumber: 1,
              targetReps: 10,
              targetWeight: 50,
              isWarmup: false,
              restSeconds: 90,
            },
          ],
        },
      ],
    };

    await expect(
      createWorkoutFromGeneration(generated, conversationId),
    ).rejects.toThrow();

    // No workout should be created
    const workoutRecords = await db
      .select()
      .from(workouts)
      .where(eq(workouts.name, "Integration Test All Invalid"));
    expect(workoutRecords).toHaveLength(0);
  });

  it("links conversation to the created workout", async () => {
    const generated: GeneratedWorkout = {
      name: "Integration Test Conversation Link",
      rationale: "Testing conversation linking",
      estimatedDuration: 30,
      exercises: [
        {
          exerciseId: testExerciseIds[0],
          exerciseName: "Integration Test Bench Press",
          sets: [
            {
              setNumber: 1,
              targetReps: 8,
              targetWeight: 60,
              isWarmup: false,
              restSeconds: 120,
            },
          ],
        },
      ],
    };

    const response = await createWorkoutFromGeneration(
      generated,
      conversationId,
    );

    const workoutId = extractWorkoutId(response);
    createdWorkoutIds.push(workoutId);

    // Verify conversation is linked
    const [conv] = await db
      .select()
      .from(generationConversations)
      .where(eq(generationConversations.id, conversationId));

    expect(conv.workout_id).toBe(workoutId);

    // Clean up: unlink conversation for next tests
    await db
      .update(generationConversations)
      .set({ workout_id: null })
      .where(eq(generationConversations.id, conversationId));
  });
});
