import { Dialog } from "@radix-ui/themes";
import { Check } from "lucide-react";
import "./WorkoutSummaryDialog.css";

interface WorkoutSummaryDialogProps {
  readonly open: boolean;
  readonly workoutName: string;
  readonly durationDisplay: string;
  readonly completedSets: number;
  readonly totalSets: number;
  readonly completedExercises: number;
  readonly totalExercises: number;
  readonly onDone: () => void;
}

/** Shown once a workout is finished. */
export function WorkoutSummaryDialog({
  open,
  workoutName,
  durationDisplay,
  completedSets,
  totalSets,
  completedExercises,
  totalExercises,
  onDone,
}: WorkoutSummaryDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onDone()}>
      <Dialog.Content className="workout-summary" maxWidth="360px">
        <span className="workout-summary__badge" aria-hidden="true">
          <Check size={30} strokeWidth={2.5} />
        </span>
        <Dialog.Title className="workout-summary__title">
          Workout complete
        </Dialog.Title>
        <Dialog.Description className="workout-summary__name">
          {workoutName}
        </Dialog.Description>
        <dl className="workout-summary__stats">
          <div>
            <dt className="workout-summary__label">Duration</dt>
            <dd className="workout-summary__value">{durationDisplay}</dd>
          </div>
          <div>
            <dt className="workout-summary__label">Sets</dt>
            <dd className="workout-summary__value">
              {completedSets}
              <span className="workout-summary__total">/{totalSets}</span>
            </dd>
          </div>
          <div>
            <dt className="workout-summary__label">Exercises</dt>
            <dd className="workout-summary__value">
              {completedExercises}
              <span className="workout-summary__total">/{totalExercises}</span>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="workout-summary__done"
          onClick={onDone}
        >
          Done
        </button>
      </Dialog.Content>
    </Dialog.Root>
  );
}
