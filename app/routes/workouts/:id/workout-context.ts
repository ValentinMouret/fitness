import { useOutletContext } from "react-router";
import type { RestTimer } from "~/modules/fitness/presentation/hooks/useRestTimer";
import type { ActiveWorkoutViewModel } from "~/modules/fitness/presentation/view-models/active-workout.view-model";
import type { ExerciseOptionViewModel } from "~/modules/fitness/presentation/view-models/exercise-option.view-model";

/** What the workout layout shares with its screens. */
export interface WorkoutContext {
  readonly workout: ActiveWorkoutViewModel;
  /** A finished workout only allows correcting saved sets. */
  readonly isComplete: boolean;
  readonly exerciseOptions: ReadonlyArray<ExerciseOptionViewModel>;
  /** Where screens submit workout changes. */
  readonly actionPath: string;
  readonly rest: RestTimer;
  /** Asks to finish the workout; only the confirmation stops it. */
  readonly requestFinish: () => void;
}

export const useWorkoutContext = () => useOutletContext<WorkoutContext>();
