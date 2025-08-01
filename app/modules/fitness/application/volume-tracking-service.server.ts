import type { ResultAsync } from "neverthrow";
import type { ErrRepository } from "~/repository";
import type {
  WeeklyVolumeTracker,
  WorkoutSession,
  MuscleGroup,
} from "~/modules/fitness/domain/workout";
import { WeeklyVolumeTracker as WeeklyVolumeTrackerNamespace } from "~/modules/fitness/domain/workout";
import { VolumeTrackingRepository } from "~/modules/fitness/infra/volume-tracking-repository.server";

type ErrVolumeTracking = "invalid_workout_data" | "week_calculation_error";

export const VolumeTrackingService = {
  getCurrentWeekVolume(): ResultAsync<
    WeeklyVolumeTracker,
    ErrVolumeTracking | ErrRepository
  > {
    const weekStart = this.getWeekStart(new Date());

    return VolumeTrackingRepository.getWeeklyVolume(weekStart).map(
      (currentVolume) => {
        return WeeklyVolumeTrackerNamespace.create({
          weekStart,
          currentVolume,
        });
      },
    );
  },

  updateVolume(
    workout: WorkoutSession,
  ): ResultAsync<WeeklyVolumeTracker, ErrVolumeTracking | ErrRepository> {
    const muscleGroupVolumes = this.calculateMuscleGroupVolumes(workout);
    const weekStart = this.getWeekStart(new Date());

    return VolumeTrackingRepository.recordWorkoutVolume(
      workout.workout.id,
      muscleGroupVolumes,
      weekStart,
    ).andThen(() => this.getCurrentWeekVolume());
  },

  getVolumeNeeds(): ResultAsync<
    ReadonlyMap<MuscleGroup, number>,
    ErrVolumeTracking | ErrRepository
  > {
    return this.getCurrentWeekVolume().map((tracker) =>
      WeeklyVolumeTrackerNamespace.getVolumeNeeds.call(tracker),
    );
  },

  getWeeklyProgress(): ResultAsync<
    {
      tracker: WeeklyVolumeTracker;
      progressPercentage: ReadonlyMap<MuscleGroup, number>;
      isOnTrack: boolean;
    },
    ErrVolumeTracking | ErrRepository
  > {
    return this.getCurrentWeekVolume().map((tracker) => {
      const progressPercentage = new Map<MuscleGroup, number>();
      let totalProgress = 0;

      for (const target of tracker.targets) {
        const current = tracker.currentVolume.get(target.muscleGroup) ?? 0;
        const progress = Math.min((current / target.minSets) * 100, 100);
        progressPercentage.set(target.muscleGroup, progress);
        totalProgress += progress;
      }

      const averageProgress = totalProgress / tracker.targets.length;
      const isOnTrack = averageProgress >= 70; // 70% threshold for "on track"

      return {
        tracker,
        progressPercentage,
        isOnTrack,
      };
    });
  },

  calculateMuscleGroupVolumes(
    workout: WorkoutSession,
  ): ReadonlyMap<MuscleGroup, number> {
    const muscleGroupVolumes = new Map<MuscleGroup, number>();

    for (const exerciseGroup of workout.exerciseGroups) {
      const completedSets = exerciseGroup.sets.filter((set) => set.isCompleted);
      const setCount = completedSets.length;

      // Get muscle group splits for this exercise
      // Note: This would need to be fetched from the repository in a real implementation
      // For now, we'll use a placeholder approach
      const primaryMuscleGroups = this.inferPrimaryMuscleGroups(
        exerciseGroup.exercise.movementPattern,
      );

      for (const muscleGroup of primaryMuscleGroups) {
        const currentVolume = muscleGroupVolumes.get(muscleGroup) ?? 0;
        muscleGroupVolumes.set(muscleGroup, currentVolume + setCount);
      }
    }

    return muscleGroupVolumes;
  },

  inferPrimaryMuscleGroups(
    movementPattern: string,
  ): ReadonlyArray<MuscleGroup> {
    // Simplified mapping of movement patterns to primary muscle groups
    const patternToMuscleGroups: Record<string, ReadonlyArray<MuscleGroup>> = {
      push: ["pecs", "delts", "triceps"],
      pull: ["lats", "trapezes", "biceps"],
      squat: ["quads", "glutes"],
      hinge: ["armstrings", "glutes", "lower_back"],
      core: ["abs"],
      isolation: [], // Would need exercise-specific mapping
      rotation: ["abs"],
      gait: ["calves", "quads"],
    };

    return patternToMuscleGroups[movementPattern] ?? [];
  },

  getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  },
};
