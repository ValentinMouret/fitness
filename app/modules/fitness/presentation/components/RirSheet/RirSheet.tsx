import { BottomSheet } from "~/components/BottomSheet";
import {
  type ReportedRir,
  reportedRirValues,
} from "~/modules/fitness/domain/workout";
import { formatRir } from "../../view-models/active-workout.view-model";
import "./RirSheet.css";

interface RirSheetProps {
  readonly open: boolean;
  readonly current?: ReportedRir;
  readonly onPick: (rir: ReportedRir) => void;
  readonly onClose: () => void;
}

/** Asks how many more clean reps the lifter could have done. */
export function RirSheet({ open, current, onPick, onClose }: RirSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Reps in reserve"
      description="How many more clean reps could you have done?"
    >
      <div className="rir-sheet__options">
        {reportedRirValues
          .filter((rir) => rir !== "unsure")
          .map((rir) => (
            <button
              key={rir}
              type="button"
              className={
                current === rir
                  ? "rir-sheet__option rir-sheet__option--on"
                  : "rir-sheet__option"
              }
              aria-pressed={current === rir}
              onClick={() => onPick(rir)}
            >
              {formatRir(rir)}
            </button>
          ))}
      </div>
      <button
        type="button"
        className={
          current === "unsure"
            ? "rir-sheet__unsure rir-sheet__unsure--on"
            : "rir-sheet__unsure"
        }
        aria-pressed={current === "unsure"}
        onClick={() => onPick("unsure")}
      >
        Not sure
      </button>
    </BottomSheet>
  );
}
