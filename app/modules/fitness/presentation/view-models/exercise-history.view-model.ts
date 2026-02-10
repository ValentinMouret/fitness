import type {
  ExerciseHistoryPage,
  ExerciseHistorySession,
} from "~/modules/fitness/domain/workout";

export interface ExerciseHistorySetRow {
  readonly set: number;
  readonly weight: string;
  readonly reps: string;
  readonly volume: string;
  readonly isWarmup: boolean;
}

export interface ExerciseHistorySessionViewModel {
  readonly workoutId: string;
  readonly workoutName: string;
  readonly dateDisplay: string;
  readonly sets: ReadonlyArray<ExerciseHistorySetRow>;
  readonly totalVolumeDisplay: string;
  readonly maxWeightDisplay: string;
  readonly estimatedOneRepMaxDisplay: string;
}

export interface ExerciseHistoryChartPoint {
  readonly date: string;
  readonly totalVolume: number;
  readonly maxWeight: number;
  readonly estimatedOneRepMax: number;
  readonly bestSetVolume: number;
}

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeight(value?: number): string {
  if (value === undefined || value === 0) return "—";
  return `${value} kg`;
}

function createSessionViewModel(
  session: ExerciseHistorySession,
): ExerciseHistorySessionViewModel {
  const sets: ExerciseHistorySetRow[] = session.sets.map((s) => {
    const reps = s.reps ?? 0;
    const weight = s.weight ?? 0;
    const vol = reps * weight;
    return {
      set: s.set,
      weight: weight > 0 ? `${weight}` : "—",
      reps: reps > 0 ? `${reps}` : "—",
      volume: vol > 0 ? `${Math.round(vol)}` : "—",
      isWarmup: s.isWarmup,
    };
  });

  return {
    workoutId: session.workoutId,
    workoutName: session.workoutName,
    dateDisplay: formatDate(session.date),
    sets,
    totalVolumeDisplay: formatWeight(session.totalVolume),
    maxWeightDisplay: formatWeight(session.maxWeight),
    estimatedOneRepMaxDisplay: formatWeight(session.estimatedOneRepMax),
  };
}

export function createExerciseHistoryViewModels(
  page: ExerciseHistoryPage,
): ReadonlyArray<ExerciseHistorySessionViewModel> {
  return page.sessions.map(createSessionViewModel);
}

export function createExerciseHistoryChartData(
  sessions: ReadonlyArray<ExerciseHistorySession>,
): ReadonlyArray<ExerciseHistoryChartPoint> {
  // Oldest first for chart
  return [...sessions].reverse().map((s) => ({
    date: formatDate(s.date),
    totalVolume: s.totalVolume,
    maxWeight: s.maxWeight ?? 0,
    estimatedOneRepMax: s.estimatedOneRepMax ?? 0,
    bestSetVolume: s.bestSetVolume,
  }));
}
