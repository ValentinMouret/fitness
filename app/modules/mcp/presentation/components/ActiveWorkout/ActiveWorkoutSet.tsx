import { useId, useState } from "react";
import { z } from "zod";
import type { ActiveWorkoutSnapshot } from "~/modules/fitness/domain/active-workout";
import { reportedRirValues } from "~/modules/fitness/domain/workout";
export type SnapshotSet =
  ActiveWorkoutSnapshot["exerciseGroups"][number]["sets"][number];
export type SetDraft = Readonly<{
  reps: string;
  weight: string;
  reportedRir: string;
}>;
export const draftForSet = (set: SnapshotSet): SetDraft => ({
  reps: set.reps?.toString() ?? "",
  weight: set.weight?.toString() ?? "",
  reportedRir: set.reportedRir ?? "",
});
interface Props {
  readonly set: SnapshotSet;
  readonly draft: SetDraft;
  readonly pending: boolean;
  readonly stopped: boolean;
  readonly onChange: (draft: SetDraft) => void;
  readonly onSave: () => void;
  readonly dirty: boolean;
  readonly onCancel: () => void;
}
export function ActiveWorkoutSet({
  set,
  draft,
  pending,
  stopped,
  onChange,
  onSave,
  dirty,
  onCancel,
}: Props) {
  const [effortOpen, setEffortOpen] = useState(false);
  const targetId = useId();
  return (
    <div className={`mcp-set ${set.isCompleted ? "mcp-set--done" : ""}`}>
      <div className="mcp-set-grid">
        <span
          className={`mcp-set-number ${set.isWarmup ? "mcp-set-number--warm" : ""}`}
        >
          {set.isWarmup ? "W" : set.set}
        </span>
        <label className="mcp-value">
          <span className="mcp-sr">Set {set.set} actual reps</span>
          <input
            inputMode="numeric"
            aria-label={`Set ${set.set} actual reps`}
            aria-describedby={set.targetReps !== null ? targetId : undefined}
            value={draft.reps}
            disabled={pending || stopped}
            placeholder="—"
            onChange={(event) =>
              onChange({ ...draft, reps: event.target.value })
            }
          />
          {set.targetReps !== null && (
            <span id={targetId} className="mcp-target">
              Target {set.targetReps}
            </span>
          )}
        </label>
        <label className="mcp-value">
          <span className="mcp-sr">Set {set.set} actual weight in kg</span>
          <input
            inputMode="decimal"
            aria-label={`Set ${set.set} actual weight in kg`}
            value={draft.weight}
            disabled={pending || stopped}
            placeholder="—"
            onChange={(event) =>
              onChange({ ...draft, weight: event.target.value })
            }
          />
          <span className="mcp-unit">kg · optional</span>
        </label>
        {set.isWarmup ? (
          <span />
        ) : (
          <button
            type="button"
            className="mcp-effort"
            aria-label={`Set ${set.set} RIR, ${draft.reportedRir === "unsure" ? "unsure" : draft.reportedRir || "unreported"}`}
            aria-expanded={effortOpen}
            onClick={() => setEffortOpen(!effortOpen)}
            disabled={pending || stopped}
          >
            {draft.reportedRir === "unsure" ? "?" : draft.reportedRir || "—"}
          </button>
        )}
        <button
          type="button"
          className={`mcp-log ${set.isCompleted ? "mcp-log--done" : ""}`}
          disabled={pending || stopped}
          aria-label={`${set.isCompleted ? "Save changes to" : "Log"} set ${set.set}`}
          onClick={onSave}
        >
          {pending ? "…" : set.isCompleted ? "✓" : "Log"}
        </button>
      </div>
      {dirty && (
        <div className="mcp-set-extra">
          <button
            type="button"
            disabled={pending || stopped}
            onClick={onCancel}
          >
            Reset inputs
          </button>
        </div>
      )}
      {!set.isWarmup && effortOpen && (
        <label className="mcp-rir">
          RIR <span>How many good reps could you have done?</span>
          <select
            aria-label={`Set ${set.set} RIR`}
            value={draft.reportedRir}
            disabled={pending || stopped}
            onChange={(event) =>
              onChange({
                ...draft,
                reportedRir: z
                  .union([z.enum(reportedRirValues), z.literal("")])
                  .parse(event.target.value),
              })
            }
          >
            <option value="">Unreported</option>
            {reportedRirValues.map((value) => (
              <option key={value} value={value}>
                {value === "unsure" ? "Unsure" : value}
              </option>
            ))}
          </select>
        </label>
      )}
      {set.note && <p className="mcp-set-note">{set.note}</p>}
    </div>
  );
}
