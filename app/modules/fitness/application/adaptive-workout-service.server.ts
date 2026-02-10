import { err, ok, type Result, ResultAsync } from "neverthrow";
import type {
  AdaptiveWorkoutRequest,
  AdaptiveWorkoutResult,
  EquipmentInstance,
  Exercise,
  ExerciseMuscleGroups,
  MovementPattern,
  MuscleGroup,
} from "~/modules/fitness/domain/workout";
import {
  MovementPatternSequencer,
  Workout as WorkoutNamespace,
  WorkoutSession as WorkoutSessionNamespace,
} from "~/modules/fitness/domain/workout";
import { AdaptiveWorkoutRepository } from "~/modules/fitness/infra/adaptive-workout-repository.server";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import type { ErrRepository } from "~/repository";

type ErrWorkoutGeneration =
  | "no_available_equipment"
  | "insufficient_exercises"
  | "duration_constraint_failed";

type ErrSubstitution =
  | "exercise_not_found"
  | "no_suitable_substitutes"
  | "equipment_unavailable";

export const AdaptiveWorkoutService = {
  generateWorkout(
    request: AdaptiveWorkoutRequest,
  ): ResultAsync<AdaptiveWorkoutResult, ErrWorkoutGeneration | ErrRepository> {
    return ExerciseMuscleGroupsRepository.listAll().andThen((allExercises) => {
      const availableExercises = this.filterByAvailableEquipment(
        allExercises,
        request.availableEquipment,
      );

      if (availableExercises.length === 0) {
        return ResultAsync.fromPromise(
          Promise.reject("no_available_equipment" as const),
          (error) => error as ErrWorkoutGeneration,
        );
      }

      const selectedExercises = this.selectOptimalExercises(
        availableExercises,
        request,
      );

      if (selectedExercises.isErr()) {
        return ResultAsync.fromPromise(
          Promise.reject(selectedExercises.error),
          (error) => error as ErrWorkoutGeneration,
        );
      }

      const workout = WorkoutNamespace.create({
        name: `Adaptive Workout - ${new Date().toLocaleDateString()}`,
      });

      const workoutSession = WorkoutSessionNamespace.create({
        workout: { ...workout, id: "temp-id" },
        exercises: selectedExercises.value.map((exercise, index) => ({
          exercise: exercise.exercise,
          orderIndex: index,
        })),
      });

      const alternatives = this.generateAlternatives(
        selectedExercises.value,
        availableExercises,
      );

      const floorSwitches = this.calculateFloorSwitches(
        selectedExercises.value,
        request.availableEquipment,
      );

      const estimatedDuration = this.estimateDuration(selectedExercises.value);

      const result: AdaptiveWorkoutResult = {
        workout: workoutSession,
        alternatives,
        floorSwitches,
        estimatedDuration,
      };

      return ResultAsync.fromSafePromise(Promise.resolve(result));
    });
  },

  replaceExercise(
    _workoutId: string,
    exerciseId: string,
    availableEquipment: ReadonlyArray<EquipmentInstance>,
  ): ResultAsync<Exercise, ErrSubstitution | ErrRepository> {
    return AdaptiveWorkoutRepository.findSubstitutes(exerciseId).andThen(
      (substitutes) => {
        if (substitutes.length === 0) {
          return ResultAsync.fromPromise(
            Promise.reject("no_suitable_substitutes" as const),
            (error) => error as ErrSubstitution,
          );
        }

        const availableSubstitutes = this.filterByAvailableEquipment(
          substitutes,
          availableEquipment,
        );

        if (availableSubstitutes.length === 0) {
          return ResultAsync.fromPromise(
            Promise.reject("equipment_unavailable" as const),
            (error) => error as ErrSubstitution,
          );
        }

        // Select best substitute based on similarity score
        const bestSubstitute = availableSubstitutes.reduce((best, current) =>
          this.compareSubstitutes(best, current) > 0 ? best : current,
        );

        return ResultAsync.fromSafePromise(
          Promise.resolve(bestSubstitute.exercise),
        );
      },
    );
  },

  filterByAvailableEquipment(
    exercises: ReadonlyArray<ExerciseMuscleGroups>,
    availableEquipment: ReadonlyArray<EquipmentInstance>,
  ): ReadonlyArray<ExerciseMuscleGroups> {
    const availableTypes = new Set(
      availableEquipment
        .filter((eq) => eq.isAvailable)
        .map((eq) => eq.exerciseType),
    );

    return exercises.filter((exercise) =>
      availableTypes.has(exercise.exercise.type),
    );
  },

  selectOptimalExercises(
    availableExercises: ReadonlyArray<ExerciseMuscleGroups>,
    request: AdaptiveWorkoutRequest,
  ): Result<ReadonlyArray<ExerciseMuscleGroups>, ErrWorkoutGeneration> {
    const maxExercises = Math.floor(request.targetDuration / 8); // ~8 min per exercise
    const selectedExercises: ExerciseMuscleGroups[] = [];
    const usedPatterns: MovementPattern[] = [];
    const equipmentPreferences = this.getEquipmentPreferences();

    // Prioritize by volume needs if provided
    const volumeNeeds = request.volumeNeeds ?? new Map();
    const priorityMuscleGroups = Array.from(volumeNeeds.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([muscleGroup]) => muscleGroup);

    for (
      let i = 0;
      i < maxExercises && selectedExercises.length < maxExercises;
      i++
    ) {
      const recommendation =
        MovementPatternSequencer.getNextPattern(usedPatterns);

      const candidates = availableExercises.filter(
        (exercise) =>
          exercise.exercise.movementPattern === recommendation.nextPattern &&
          !selectedExercises.some(
            (selected) => selected.exercise.id === exercise.exercise.id,
          ),
      );

      if (candidates.length === 0) {
        // Fallback to any available pattern
        const fallbackCandidates = availableExercises.filter(
          (exercise) =>
            !selectedExercises.some(
              (selected) => selected.exercise.id === exercise.exercise.id,
            ),
        );

        if (fallbackCandidates.length === 0) break;

        const bestCandidate = this.selectBestExercise(
          fallbackCandidates,
          priorityMuscleGroups,
          equipmentPreferences,
          request.availableEquipment,
        );

        selectedExercises.push(bestCandidate);
        usedPatterns.push(bestCandidate.exercise.movementPattern);
      } else {
        const bestCandidate = this.selectBestExercise(
          candidates,
          priorityMuscleGroups,
          equipmentPreferences,
          request.availableEquipment,
        );

        selectedExercises.push(bestCandidate);
        usedPatterns.push(recommendation.nextPattern);
      }
    }

    if (selectedExercises.length < 3) {
      return err("insufficient_exercises");
    }

    return ok(selectedExercises);
  },

  selectBestExercise(
    candidates: ReadonlyArray<ExerciseMuscleGroups>,
    priorityMuscleGroups: ReadonlyArray<MuscleGroup>,
    equipmentPreferences: ReadonlyMap<string, number>,
    availableEquipment: ReadonlyArray<EquipmentInstance>,
  ): ExerciseMuscleGroups {
    return candidates.reduce((best, current) => {
      const bestScore = this.scoreExercise(
        best,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );
      const currentScore = this.scoreExercise(
        current,
        priorityMuscleGroups,
        equipmentPreferences,
        availableEquipment,
      );

      return currentScore > bestScore ? current : best;
    });
  },

  scoreExercise(
    exercise: ExerciseMuscleGroups,
    priorityMuscleGroups: ReadonlyArray<MuscleGroup>,
    equipmentPreferences: ReadonlyMap<string, number>,
    availableEquipment: ReadonlyArray<EquipmentInstance>,
  ): number {
    let score = 0;

    // Priority muscle group bonus
    for (const muscleGroupSplit of exercise.muscleGroupSplits) {
      const priorityIndex = priorityMuscleGroups.indexOf(
        muscleGroupSplit.muscleGroup,
      );
      if (priorityIndex !== -1) {
        score +=
          (priorityMuscleGroups.length - priorityIndex) *
          muscleGroupSplit.split;
      }
    }

    // Equipment preference bonus
    const equipmentKey = exercise.exercise.type;
    const preferenceScore = equipmentPreferences.get(equipmentKey) ?? 1;
    score += preferenceScore * 10;

    // Floor consistency bonus (prefer same floor)
    const exerciseFloors = availableEquipment
      .filter(
        (eq) => eq.exerciseType === exercise.exercise.type && eq.isAvailable,
      )
      .map((eq) => eq.gymFloorId);

    if (exerciseFloors.length > 0) {
      score += 5; // Bonus for being available
    }

    return score;
  },

  generateAlternatives(
    selectedExercises: ReadonlyArray<ExerciseMuscleGroups>,
    availableExercises: ReadonlyArray<ExerciseMuscleGroups>,
  ): ReadonlyMap<Exercise["id"], ReadonlyArray<Exercise>> {
    const alternatives = new Map<Exercise["id"], ReadonlyArray<Exercise>>();

    for (const selected of selectedExercises) {
      const samePatternExercises = availableExercises
        .filter(
          (exercise) =>
            exercise.exercise.movementPattern ===
              selected.exercise.movementPattern &&
            exercise.exercise.id !== selected.exercise.id,
        )
        .slice(0, 3) // Limit to 3 alternatives
        .map((exercise) => exercise.exercise);

      alternatives.set(selected.exercise.id, samePatternExercises);
    }

    return alternatives;
  },

  calculateFloorSwitches(
    selectedExercises: ReadonlyArray<ExerciseMuscleGroups>,
    availableEquipment: ReadonlyArray<EquipmentInstance>,
  ): number {
    let switches = 0;
    let currentFloor: string | null = null;

    for (const exercise of selectedExercises) {
      const equipmentForExercise = availableEquipment.find(
        (eq) => eq.exerciseType === exercise.exercise.type && eq.isAvailable,
      );

      if (equipmentForExercise) {
        if (currentFloor && currentFloor !== equipmentForExercise.gymFloorId) {
          switches++;
        }
        currentFloor = equipmentForExercise.gymFloorId;
      }
    }

    return switches;
  },

  estimateDuration(
    selectedExercises: ReadonlyArray<ExerciseMuscleGroups>,
  ): number {
    // Base estimate: 8 minutes per exercise (3 sets, 2 min rest, setup time)
    return selectedExercises.length * 8;
  },

  getEquipmentPreferences(): ReadonlyMap<string, number> {
    // Equipment preferences: Cables > Dumbbells > Barbells > Machines
    return new Map([
      ["cable", 4],
      ["dumbbells", 3],
      ["barbell", 2],
      ["machine", 1],
      ["bodyweight", 3],
    ]);
  },

  compareSubstitutes(
    _a: ExerciseMuscleGroups,
    _b: ExerciseMuscleGroups,
  ): number {
    // Placeholder for substitute comparison logic
    // In a real implementation, this would use similarity scores from the database
    return Math.random() - 0.5; // Random for now
  },
};
