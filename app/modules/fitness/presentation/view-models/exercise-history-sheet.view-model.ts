import { z } from "zod";
import { reportedRirValues } from "~/modules/fitness/domain/workout";
import { formatRir, setLabels } from "./active-workout.view-model";

/** The `/api/exercises/history` response as received over the wire. */
export const exerciseHistoryResponseSchema = z.object({
  sessions: z.array(
    z.object({
      workoutId: z.string(),
      workoutName: z.string(),
      date: z.coerce.date(),
      totalVolume: z.number(),
      maxWeight: z.number().optional(),
      estimatedOneRepMax: z.number().optional(),
      sets: z.array(
        z.object({
          set: z.number(),
          reps: z.number().optional(),
          weight: z.number().optional(),
          isWarmup: z.boolean(),
          reportedRir: z.enum(reportedRirValues).optional(),
          rpe: z.number().optional(),
        }),
      ),
    }),
  ),
});

export type ExerciseHistoryResponse = z.infer<
  typeof exerciseHistoryResponseSchema
>;

export interface HistorySetViewModel {
  readonly key: number;
  readonly label: string;
  readonly isWarmup: boolean;
  readonly repsDisplay: string;
  readonly weightDisplay: string;
  readonly rirDisplay: string;
}

export interface HistorySessionViewModel {
  readonly workoutId: string;
  readonly workoutName: string;
  readonly dateDisplay: string;
  readonly sets: ReadonlyArray<HistorySetViewModel>;
}

function formatWeight(weight: number | undefined, isBodyweight: boolean) {
  if (isBodyweight) return weight ? `+${weight} kg` : "BW";
  return weight === undefined ? "–" : `${weight} kg`;
}

export function createHistorySessionViewModels(
  response: ExerciseHistoryResponse,
  isBodyweight: boolean,
): ReadonlyArray<HistorySessionViewModel> {
  return response.sessions.map((session) => {
    const labels = setLabels(session.sets);
    return {
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      dateDisplay: session.date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      sets: session.sets.map((set, index) => ({
        key: set.set,
        label: labels[index],
        isWarmup: set.isWarmup,
        repsDisplay: set.reps === undefined ? "–" : String(set.reps),
        weightDisplay: formatWeight(set.weight, isBodyweight),
        rirDisplay: set.isWarmup
          ? ""
          : set.reportedRir !== undefined
            ? `RIR ${formatRir(set.reportedRir)}`
            : set.rpe !== undefined
              ? `RPE ${set.rpe}`
              : "",
      })),
    };
  });
}

export interface ProgressPointViewModel {
  readonly dateDisplay: string;
  readonly value: number;
}

/** One plottable metric across sessions, oldest first. */
export interface ProgressMetricViewModel {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly points: ReadonlyArray<ProgressPointViewModel>;
  readonly latestDisplay: string;
  readonly changeDisplay: string;
}

type HistorySession = ExerciseHistoryResponse["sessions"][number];

interface MetricDefinition {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly value: (session: HistorySession) => number | undefined;
}

const workingReps = (session: HistorySession) =>
  session.sets
    .filter((set) => !set.isWarmup)
    .reduce((total, set) => total + (set.reps ?? 0), 0);

const positive = (value: number | undefined) =>
  value !== undefined && value > 0 ? value : undefined;

const weightedMetrics: ReadonlyArray<MetricDefinition> = [
  {
    key: "volume",
    label: "Volume",
    unit: "kg",
    value: (session) => positive(session.totalVolume),
  },
  {
    key: "e1rm",
    label: "Est. 1RM",
    unit: "kg",
    value: (session) => session.estimatedOneRepMax,
  },
  {
    key: "top",
    label: "Top weight",
    unit: "kg",
    value: (session) => session.maxWeight,
  },
];

const bodyweightMetrics: ReadonlyArray<MetricDefinition> = [
  {
    key: "reps",
    label: "Reps",
    unit: "reps",
    value: (session) => positive(workingReps(session)),
  },
  {
    key: "load",
    label: "Added load",
    unit: "kg",
    value: (session) => session.maxWeight,
  },
];

const formatNumber = (value: number) =>
  value.toLocaleString("en-GB", { maximumFractionDigits: 1 });

function formatChange(change: number, unit: string, since: string) {
  if (change === 0) return `No change since ${since}`;
  const sign = change > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(change))} ${unit} since ${since}`;
}

/** Metrics with at least two sessions to compare; empty when there is no trend. */
export function createProgressMetricViewModels(
  response: ExerciseHistoryResponse,
  isBodyweight: boolean,
): ReadonlyArray<ProgressMetricViewModel> {
  const chronological = [...response.sessions].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const definitions = isBodyweight ? bodyweightMetrics : weightedMetrics;

  return definitions.flatMap((definition) => {
    const points = chronological.flatMap((session) => {
      const value = definition.value(session);
      return value === undefined
        ? []
        : [
            {
              dateDisplay: session.date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              }),
              value,
            },
          ];
    });
    if (points.length < 2) return [];
    const first = points[0];
    const latest = points[points.length - 1];
    return [
      {
        key: definition.key,
        label: definition.label,
        unit: definition.unit,
        points,
        latestDisplay: `${formatNumber(latest.value)} ${definition.unit}`,
        changeDisplay: formatChange(
          Math.round((latest.value - first.value) * 10) / 10,
          definition.unit,
          first.dateDisplay,
        ),
      },
    ];
  });
}
