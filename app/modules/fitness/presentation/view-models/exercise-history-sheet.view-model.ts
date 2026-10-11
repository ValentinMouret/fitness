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
