import { Check, Trash2 } from "lucide-react";
import type { ActiveSetViewModel } from "../../view-models/active-workout.view-model";
import { SetValueCell } from "./SetValueCell";
import "./ActiveSetRow.css";

interface ActiveSetRowProps {
  readonly set: ActiveSetViewModel;
  readonly isBodyweight: boolean;
  /** "log" while training; "correct" only edits saved sets of a finished workout. */
  readonly mode: "log" | "correct";
  readonly onChange: (field: "reps" | "weight", value: string) => void;
  readonly onToggleComplete: () => void;
  readonly onToggleWarmup: () => void;
  readonly onRemove: () => void;
  readonly onEditRir: () => void;
}

/** One set: number, reps, load, then delete or RIR, and the completion tick. */
export function ActiveSetRow({
  set,
  isBodyweight,
  mode,
  onChange,
  onToggleComplete,
  onToggleWarmup,
  onRemove,
  onEditRir,
}: ActiveSetRowProps) {
  const name = set.isWarmup ? "Warm-up set" : `Set ${set.label}`;
  const className = [
    "active-set",
    set.isCompleted && "active-set--done",
    mode === "log" && set.isNext && "active-set--next",
  ]
    .filter(Boolean)
    .join(" ");
  const hasLoad = set.weight.value !== undefined;
  const isLogging = mode === "log";
  const isEditable = isLogging || set.isCompleted;
  const numberClassName = set.isWarmup
    ? "active-set__no active-set__no--warm"
    : "active-set__no";

  return (
    <li className={className}>
      {isLogging ? (
        <button
          type="button"
          className={numberClassName}
          aria-pressed={set.isWarmup}
          aria-label={
            set.isWarmup
              ? "Warm-up set. Tap to make it a working set"
              : `${name}. Tap to mark as warm-up`
          }
          onClick={onToggleWarmup}
        >
          {set.label}
        </button>
      ) : (
        <span className={numberClassName}>{set.label}</span>
      )}
      <SetValueCell
        label={`${name} reps`}
        cell={set.reps}
        readOnly={!isEditable}
        onCommit={(value) => {
          // Zero reps is not a set; keep the current value.
          if (!/^0+$/.test(value)) onChange("reps", value);
        }}
      />
      <SetValueCell
        label={isBodyweight ? `${name} added weight` : `${name} weight`}
        cell={set.weight}
        decimals
        readOnly={!isEditable}
        prefix={isBodyweight && hasLoad ? "+" : undefined}
        unit={hasLoad ? "kg" : undefined}
        muted={isBodyweight && !hasLoad}
        onCommit={(value) => onChange("weight", value === "0" ? "" : value)}
      />
      {set.isCompleted && !set.isWarmup ? (
        <button
          type="button"
          className={
            set.reportedRir === undefined
              ? "active-set__rir active-set__rir--empty"
              : "active-set__rir"
          }
          aria-label={
            set.effortLabel === "RPE"
              ? `${name} legacy RPE ${set.rirDisplay}. Add reps in reserve`
              : `${name} reps in reserve: ${set.rirDisplay}`
          }
          onClick={onEditRir}
        >
          <span className="active-set__rir-label">{set.effortLabel}</span>
          {set.rirDisplay}
        </button>
      ) : isLogging && !set.isCompleted ? (
        <button
          type="button"
          className="active-set__remove"
          aria-label={`Remove ${name.toLowerCase()}`}
          onClick={onRemove}
        >
          <Trash2 size={17} />
        </button>
      ) : (
        <span />
      )}
      {isLogging ? (
        <button
          type="button"
          className={
            set.isCompleted
              ? "active-set__tick active-set__tick--on"
              : "active-set__tick"
          }
          aria-pressed={set.isCompleted}
          aria-label={`Complete ${name.toLowerCase()}`}
          onClick={onToggleComplete}
        >
          <Check size={20} strokeWidth={2.4} />
        </button>
      ) : set.isCompleted ? (
        <span
          className="active-set__tick active-set__tick--on"
          role="img"
          aria-label="Saved"
        >
          <Check size={20} strokeWidth={2.4} />
        </span>
      ) : (
        <span />
      )}
    </li>
  );
}
