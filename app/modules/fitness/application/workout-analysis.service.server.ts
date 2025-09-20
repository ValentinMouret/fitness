import { ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "../infra/workout.repository.server";
import { VolumeTrackingService } from "./volume-tracking-service.server";
import type { WorkoutAnalysisData } from "../infra/ai-fitness-coach.service";
import type {
  WorkoutSession,
  MuscleGroup,
  MovementPattern,
  ExerciseType,
  WeeklyVolumeTracker,
} from "../domain/workout";

type ErrWorkoutAnalysis = "insufficient_data" | "calculation_error";

export const WorkoutAnalysisService = {
  generateAnalysisData(
    weeksBack = 12,
  ): ResultAsync<WorkoutAnalysisData, ErrWorkoutAnalysis | ErrRepository> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeksBack * 7);

    return ResultAsync.combine([
      WorkoutRepository.findAll(),
      VolumeTrackingService.getCurrentWeekVolume(),
      VolumeTrackingService.getWeeklyProgress(),
    ])
      .mapErr(() => "calculation_error" as const)
      .andThen(([allWorkouts, currentWeekVolume, weeklyProgress]) => {
        // Filter workouts within timeframe
        const relevantWorkouts = allWorkouts.filter(
          (workout) =>
            workout.start >= startDate &&
            workout.start <= endDate &&
            workout.stop,
        );

        if (relevantWorkouts.length < 5) {
          return ResultAsync.fromPromise(
            Promise.reject("insufficient_data"),
            () => "insufficient_data" as const,
          );
        }

        return ResultAsync.fromPromise(
          buildAnalysisData(
            relevantWorkouts,
            startDate,
            endDate,
            currentWeekVolume,
            weeklyProgress,
          ),
          () => "calculation_error" as const,
        );
      });
  },
};

async function buildAnalysisData(
  workouts: Array<{
    id: string;
    name: string;
    start: Date;
    stop?: Date;
    notes?: string;
  }>,
  startDate: Date,
  endDate: Date,
  currentWeekVolume: WeeklyVolumeTracker,
  weeklyProgress: {
    tracker: WeeklyVolumeTracker;
    progressPercentage: ReadonlyMap<MuscleGroup, number>;
    isOnTrack: boolean;
  },
): Promise<WorkoutAnalysisData> {
  try {
    // Get detailed workout sessions
    const workoutSessionsResults = await Promise.all(
      workouts.map((workout) =>
        WorkoutSessionRepository.findById(workout.id).match(
          (session) => session,
          () => null,
        ),
      ),
    );

    const workoutSessions = workoutSessionsResults.filter(
      (session): session is WorkoutSession => session !== null,
    );

    const totalWorkouts = workouts.length;
    const weeksActive = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    // Calculate metrics
    const progressionMetrics = await calculateProgressionMetrics(
      workoutSessions,
      weeksActive,
    );
    const muscleGroupBalance = calculateMuscleGroupBalance(
      workoutSessions,
      currentWeekVolume,
      weeklyProgress,
    );
    const exerciseDistribution = calculateExerciseDistribution(workoutSessions);
    const workoutCharacteristics =
      calculateWorkoutCharacteristics(workoutSessions);

    const analysisData: WorkoutAnalysisData = {
      timeframe: {
        startDate,
        endDate,
        totalWorkouts,
        weeksActive,
      },
      progressionMetrics,
      muscleGroupBalance,
      exerciseDistribution,
      workoutCharacteristics,
    };

    return analysisData;
  } catch (error) {
    console.error("Error building analysis data:", error);
    throw error;
  }
}

async function calculateProgressionMetrics(
  workoutSessions: WorkoutSession[],
  weeksActive: number,
) {
  // Calculate strength progression for key exercises
  const exerciseProgressions = new Map<
    string,
    Array<{ date: Date; weight: number }>
  >();

  for (const session of workoutSessions) {
    for (const exerciseGroup of session.exerciseGroups) {
      const exerciseName = exerciseGroup.exercise.name;
      const completedSets = exerciseGroup.sets.filter(
        (set) => set.isCompleted && set.weight && !set.isWarmup,
      );

      if (completedSets.length > 0) {
        const weights = completedSets
          .map((set) => set.weight)
          .filter((weight): weight is number => weight !== undefined);
        const maxWeight = Math.max(...weights);
        if (!exerciseProgressions.has(exerciseName)) {
          exerciseProgressions.set(exerciseName, []);
        }
        const progression = exerciseProgressions.get(exerciseName);
        if (progression) {
          progression.push({
            date: session.workout.start,
            weight: maxWeight,
          });
        }
      }
    }
  }

  // Calculate strength progression for exercises with enough data points
  const strengthProgression = Array.from(exerciseProgressions.entries())
    .filter(([_, dataPoints]) => dataPoints.length >= 4)
    .map(([exerciseName, dataPoints]) => {
      const sortedPoints = dataPoints.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const firstQuarter = sortedPoints.slice(
        0,
        Math.ceil(sortedPoints.length / 4),
      );
      const lastQuarter = sortedPoints.slice(
        -Math.ceil(sortedPoints.length / 4),
      );

      const startingWeight =
        firstQuarter.reduce((sum, point) => sum + point.weight, 0) /
        firstQuarter.length;
      const currentWeight =
        lastQuarter.reduce((sum, point) => sum + point.weight, 0) /
        lastQuarter.length;
      const percentIncrease =
        ((currentWeight - startingWeight) / startingWeight) * 100;

      return {
        exercise: exerciseName,
        startingWeight: Math.round(startingWeight * 100) / 100,
        currentWeight: Math.round(currentWeight * 100) / 100,
        percentIncrease,
      };
    })
    .filter((progression) => Math.abs(progression.percentIncrease) > 1)
    .sort((a, b) => Math.abs(b.percentIncrease) - Math.abs(a.percentIncrease))
    .slice(0, 8);

  // Calculate volume progression by muscle group
  const weeklyVolumeData = calculateWeeklyVolumeProgression(workoutSessions);
  const volumeProgression = Array.from(weeklyVolumeData.entries()).map(
    ([muscleGroup, weeklyVolumes]) => {
      const trend = calculateTrend(weeklyVolumes);
      const avgVolume =
        weeklyVolumes.reduce((sum, vol) => sum + vol, 0) / weeklyVolumes.length;

      return {
        muscleGroup,
        weeklyAverageVolume: Math.round(avgVolume),
        trend,
      };
    },
  );

  // Calculate frequency trends
  const workoutDates = workoutSessions
    .map((session) => session.workout.start)
    .sort();
  const streaks = calculateWorkoutStreaks(workoutDates);
  const longestStreak = Math.max(...streaks, 0);
  const averageWorkoutsPerWeek = workoutSessions.length / weeksActive;
  const consistencyScore = Math.min(
    10,
    averageWorkoutsPerWeek * 2.5 + longestStreak * 0.2,
  );

  return {
    strengthProgression,
    volumeProgression,
    frequencyTrends: {
      averageWorkoutsPerWeek: Math.round(averageWorkoutsPerWeek * 10) / 10,
      longestStreak,
      consistencyScore: Math.round(consistencyScore * 10) / 10,
    },
  };
}

function calculateMuscleGroupBalance(
  workoutSessions: WorkoutSession[],
  currentWeekVolume: WeeklyVolumeTracker,
  weeklyProgress: {
    tracker: WeeklyVolumeTracker;
    progressPercentage: ReadonlyMap<MuscleGroup, number>;
    isOnTrack: boolean;
  },
) {
  // Calculate current week volume from the service data
  const currentWeekVolumeArray = weeklyProgress.tracker.targets.map(
    (target) => ({
      muscleGroup: target.muscleGroup,
      completedVolume:
        currentWeekVolume.currentVolume.get(target.muscleGroup) || 0,
      targetVolume: target.minSets,
      percentageComplete: Math.round(
        ((currentWeekVolume.currentVolume.get(target.muscleGroup) || 0) /
          target.minSets) *
          100,
      ),
    }),
  );

  // Calculate overall muscle group balance from all sessions
  const totalVolumes = new Map<string, number>();
  let totalSets = 0;

  for (const session of workoutSessions) {
    for (const exerciseGroup of session.exerciseGroups) {
      const completedSets = exerciseGroup.sets.filter(
        (set) => set.isCompleted,
      ).length;
      totalSets += completedSets;

      // Infer primary muscle groups (simplified approach)
      const primaryMuscleGroups = inferPrimaryMuscleGroups(
        exerciseGroup.exercise.movementPattern,
      );
      for (const muscleGroup of primaryMuscleGroups) {
        const current = totalVolumes.get(muscleGroup) || 0;
        totalVolumes.set(muscleGroup, current + completedSets);
      }
    }
  }

  const overallBalance = Array.from(totalVolumes.entries()).map(
    ([muscleGroup, volume]) => ({
      muscleGroup,
      totalVolume: volume,
      percentageOfTotal: Math.round((volume / totalSets) * 100),
    }),
  );

  return {
    currentWeekVolume: currentWeekVolumeArray,
    overallBalance,
  };
}

function calculateExerciseDistribution(workoutSessions: WorkoutSession[]) {
  const movementPatternCounts = new Map<MovementPattern, number>();
  const equipmentCounts = new Map<ExerciseType, number>();
  const exerciseFrequency = new Map<string, number>();
  let totalExerciseInstances = 0;

  for (const session of workoutSessions) {
    for (const exerciseGroup of session.exerciseGroups) {
      const exercise = exerciseGroup.exercise;
      totalExerciseInstances++;

      // Movement patterns
      const currentPatternCount =
        movementPatternCounts.get(exercise.movementPattern) || 0;
      movementPatternCounts.set(
        exercise.movementPattern,
        currentPatternCount + 1,
      );

      // Equipment usage
      const currentEquipmentCount = equipmentCounts.get(exercise.type) || 0;
      equipmentCounts.set(exercise.type, currentEquipmentCount + 1);

      // Exercise frequency
      const currentExerciseCount = exerciseFrequency.get(exercise.name) || 0;
      exerciseFrequency.set(exercise.name, currentExerciseCount + 1);
    }
  }

  const movementPatterns = Array.from(movementPatternCounts.entries()).map(
    ([pattern, frequency]) => ({
      pattern,
      frequency,
      percentage: Math.round((frequency / totalExerciseInstances) * 100),
    }),
  );

  const equipmentUsage = Array.from(equipmentCounts.entries()).map(
    ([type, frequency]) => ({
      type,
      frequency,
      percentage: Math.round((frequency / totalExerciseInstances) * 100),
    }),
  );

  const mostFrequentExercises = Array.from(exerciseFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, frequency]) => ({ name, frequency }));

  const totalUniqueExercises = exerciseFrequency.size;
  const averageExercisesPerWorkout =
    totalExerciseInstances / workoutSessions.length;

  return {
    movementPatterns,
    equipmentUsage,
    exerciseVariety: {
      totalUniqueExercises,
      averageExercisesPerWorkout:
        Math.round(averageExercisesPerWorkout * 10) / 10,
      mostFrequentExercises,
    },
  };
}

function calculateWorkoutCharacteristics(workoutSessions: WorkoutSession[]) {
  let totalDuration = 0;
  let totalSets = 0;
  let totalReps = 0;
  let repsCount = 0;
  let failureSets = 0;
  let warmupSets = 0;

  for (const session of workoutSessions) {
    // Calculate duration
    if (session.workout.stop) {
      const duration =
        (session.workout.stop.getTime() - session.workout.start.getTime()) /
        (1000 * 60);
      totalDuration += duration;
    }

    for (const exerciseGroup of session.exerciseGroups) {
      for (const set of exerciseGroup.sets) {
        if (set.isCompleted) {
          totalSets++;
          if (set.isFailure) failureSets++;
          if (set.isWarmup) warmupSets++;
          if (set.reps) {
            totalReps += set.reps;
            repsCount++;
          }
        }
      }
    }
  }

  const completedWorkouts = workoutSessions.filter(
    (session) => session.workout.stop,
  ).length;

  return {
    averageDuration:
      completedWorkouts > 0 ? Math.round(totalDuration / completedWorkouts) : 0,
    averageSetsPerWorkout:
      Math.round((totalSets / workoutSessions.length) * 10) / 10,
    averageRepsPerSet:
      repsCount > 0 ? Math.round((totalReps / repsCount) * 10) / 10 : 0,
    failureSetPercentage:
      totalSets > 0 ? Math.round((failureSets / totalSets) * 100) : 0,
    warmupSetPercentage:
      totalSets > 0 ? Math.round((warmupSets / totalSets) * 100) : 0,
  };
}

function calculateWeeklyVolumeProgression(workoutSessions: WorkoutSession[]) {
  const weeklyVolumes = new Map<string, Map<number, number>>();

  for (const session of workoutSessions) {
    const weekNumber = getWeekNumber(session.workout.start);

    for (const exerciseGroup of session.exerciseGroups) {
      const completedSets = exerciseGroup.sets.filter(
        (set) => set.isCompleted,
      ).length;
      const primaryMuscleGroups = inferPrimaryMuscleGroups(
        exerciseGroup.exercise.movementPattern,
      );

      for (const muscleGroup of primaryMuscleGroups) {
        if (!weeklyVolumes.has(muscleGroup)) {
          weeklyVolumes.set(muscleGroup, new Map());
        }
        const muscleGroupWeeks = weeklyVolumes.get(muscleGroup);
        if (muscleGroupWeeks) {
          const currentVolume = muscleGroupWeeks.get(weekNumber) || 0;
          muscleGroupWeeks.set(weekNumber, currentVolume + completedSets);
        }
      }
    }
  }

  // Convert to arrays for trend calculation
  const result = new Map<string, number[]>();
  for (const [muscleGroup, weeklyData] of weeklyVolumes.entries()) {
    const volumes = Array.from(weeklyData.values()).sort();
    result.set(muscleGroup, volumes);
  }

  return result;
}

function calculateTrend(
  values: number[],
): "increasing" | "stable" | "decreasing" {
  if (values.length < 3) return "stable";

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(-Math.floor(values.length / 2));

  const firstAvg =
    firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (percentChange > 10) return "increasing";
  if (percentChange < -10) return "decreasing";
  return "stable";
}

function calculateWorkoutStreaks(workoutDates: Date[]): number[] {
  if (workoutDates.length === 0) return [0];

  const streaks: number[] = [];
  let currentStreak = 1;

  for (let i = 1; i < workoutDates.length; i++) {
    const daysDiff = Math.floor(
      (workoutDates[i].getTime() - workoutDates[i - 1].getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysDiff <= 7) {
      // Within a week
      currentStreak++;
    } else {
      streaks.push(currentStreak);
      currentStreak = 1;
    }
  }

  streaks.push(currentStreak);
  return streaks;
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.ceil((days + start.getDay() + 1) / 7);
}

function inferPrimaryMuscleGroups(
  movementPattern: MovementPattern,
): MuscleGroup[] {
  const patternToMuscleGroups: Record<MovementPattern, MuscleGroup[]> = {
    push: ["pecs", "delts", "triceps"],
    pull: ["lats", "trapezes", "biceps"],
    squat: ["quads", "glutes"],
    hinge: ["armstrings", "glutes", "lower_back"],
    core: ["abs"],
    isolation: [], // Would need exercise-specific mapping
    rotation: ["abs"],
    gait: ["calves", "quads"],
  };

  return patternToMuscleGroups[movementPattern] || [];
}
