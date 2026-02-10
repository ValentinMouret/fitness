import {
  type MuscleGroup,
  type MuscleGroupCategory,
  muscleGroupCategories,
  muscleGroups,
} from "./workout";

export interface MuscleFatigueEvent {
  readonly muscleGroup: MuscleGroup;
  readonly volumeLoad: number;
  readonly workoutDate: Date;
}

export type RecoveryStatus = "fatigued" | "recovering" | "fresh";

export interface MuscleRecoveryStatus {
  readonly muscleGroup: MuscleGroup;
  readonly category: MuscleGroupCategory;
  readonly recoveryPercentage: number;
  readonly status: RecoveryStatus;
  readonly lastWorkoutDate?: Date;
  readonly hoursUntilFresh?: number;
}

export type RecoveryMap = ReadonlyArray<MuscleRecoveryStatus>;

/** Base recovery time constants (τ) in hours per muscle group. */
export const BASE_TIME_CONSTANTS: Readonly<Record<MuscleGroup, number>> = {
  pecs: 36,
  abs: 18,
  lats: 28,
  trapezes: 28,
  lower_back: 28,
  quads: 26,
  armstrings: 28,
  glutes: 28,
  calves: 16,
  delts: 20,
  biceps: 20,
  triceps: 20,
  forearm: 16,
};

/**
 * A "normal" session volume load in kg for one muscle group.
 * Used to scale τ: heavier sessions increase τ proportionally.
 */
export const BASELINE_VOLUME_LOAD = 1000;

const RECOVERY_WINDOW_HOURS = 168; // 7 days

export function getRecoveryStatus(percentage: number): RecoveryStatus {
  if (percentage >= 80) return "fresh";
  if (percentage >= 50) return "recovering";
  return "fatigued";
}

function hoursBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate remaining fatigue from a single event at a given time.
 * fatigue(t) = e^(-t / τ) where t is hours elapsed.
 */
function remainingFatigue(
  elapsedHours: number,
  tau: number,
  volumeLoad: number,
): number {
  const adjustedTau = tau * Math.max(volumeLoad / BASELINE_VOLUME_LOAD, 0.5);
  return Math.exp(-elapsedHours / adjustedTau);
}

/**
 * Estimate hours until recovery reaches a target percentage,
 * given current total fatigue and a representative tau.
 */
export function hoursUntilRecovery(
  currentFatigue: number,
  tau: number,
  targetPercentage = 80,
): number | undefined {
  const targetFatigue = 1 - targetPercentage / 100;
  if (currentFatigue <= targetFatigue) return undefined; // already there
  // fatigue(t) = currentFatigue * e^(-t/tau) = targetFatigue
  // t = -tau * ln(targetFatigue / currentFatigue)
  return -tau * Math.log(targetFatigue / currentFatigue);
}

/**
 * Compute recovery status for all muscle groups from fatigue events.
 * Each event contributes independent decaying fatigue that stacks additively.
 */
export function calculateRecovery(
  fatigueEvents: ReadonlyArray<MuscleFatigueEvent>,
  now: Date,
): RecoveryMap {
  const eventsByMuscle = new Map<MuscleGroup, MuscleFatigueEvent[]>();
  for (const event of fatigueEvents) {
    const existing = eventsByMuscle.get(event.muscleGroup) ?? [];
    existing.push(event);
    eventsByMuscle.set(event.muscleGroup, existing);
  }

  return muscleGroups.map((muscleGroup) => {
    const events = eventsByMuscle.get(muscleGroup);
    const baseTau = BASE_TIME_CONSTANTS[muscleGroup];

    if (!events || events.length === 0) {
      return {
        muscleGroup,
        category: muscleGroupCategories[muscleGroup],
        recoveryPercentage: 100,
        status: "fresh" as const,
      };
    }

    // Sort chronologically (oldest first)
    const sorted = [...events].sort(
      (a, b) => a.workoutDate.getTime() - b.workoutDate.getTime(),
    );

    let totalFatigue = 0;
    for (const event of sorted) {
      const elapsed = hoursBetween(event.workoutDate, now);
      if (elapsed < 0 || elapsed > RECOVERY_WINDOW_HOURS) continue;
      totalFatigue += remainingFatigue(elapsed, baseTau, event.volumeLoad);
    }

    const recoveryPercentage = Math.max(
      0,
      Math.min(100, Math.round((1 - totalFatigue) * 100)),
    );

    const lastWorkoutDate = sorted[sorted.length - 1].workoutDate;
    const hours = hoursUntilRecovery(totalFatigue, baseTau);

    return {
      muscleGroup,
      category: muscleGroupCategories[muscleGroup],
      recoveryPercentage,
      status: getRecoveryStatus(recoveryPercentage),
      lastWorkoutDate,
      hoursUntilFresh: hours !== undefined ? Math.round(hours) : undefined,
    };
  });
}
