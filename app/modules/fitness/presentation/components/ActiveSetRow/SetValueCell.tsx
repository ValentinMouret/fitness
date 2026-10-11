import { useState } from "react";
import type { SetValueViewModel } from "../../view-models/active-workout.view-model";

interface SetValueCellProps {
  readonly label: string;
  readonly cell: SetValueViewModel;
  readonly unit?: string;
  readonly prefix?: string;
  readonly muted?: boolean;
  readonly decimals?: boolean;
  readonly readOnly?: boolean;
  /** Called with the entered text; an empty string clears the value. */
  readonly onCommit: (value: string) => void;
}

/** A tappable value that turns into a numeric input while editing. */
export function SetValueCell({
  label,
  cell,
  unit,
  prefix,
  muted = false,
  decimals = false,
  readOnly = false,
  onCommit,
}: SetValueCellProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing)
    return (
      <span className="active-set-cell active-set-cell--editing">
        {prefix && <span className="active-set-cell__unit">{prefix}</span>}
        <input
          // biome-ignore lint/a11y/noAutofocus: the input replaces the tapped value.
          autoFocus
          aria-label={label}
          inputMode={decimals ? "decimal" : "numeric"}
          pattern={decimals ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
          defaultValue={cell.value ?? ""}
          placeholder={cell.target === undefined ? "" : String(cell.target)}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim().replace(",", ".");
            if (value !== String(cell.value ?? "")) onCommit(value);
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setIsEditing(false);
          }}
        />
        {unit && <span className="active-set-cell__unit">{unit}</span>}
      </span>
    );

  const className = [
    "active-set-cell",
    cell.isTarget && "active-set-cell--target",
    muted && "active-set-cell--muted",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {prefix && <span className="active-set-cell__unit">{prefix}</span>}
      <span className="active-set-cell__value">{cell.display}</span>
      {unit && <span className="active-set-cell__unit">{unit}</span>}
    </>
  );

  if (readOnly)
    return (
      <span className={`${className} active-set-cell--read-only`}>
        {content}
      </span>
    );

  return (
    <button
      type="button"
      className={className}
      aria-label={`${label}: ${cell.display}${cell.isTarget ? " planned" : ""}`}
      onClick={() => setIsEditing(true)}
    >
      {content}
    </button>
  );
}
