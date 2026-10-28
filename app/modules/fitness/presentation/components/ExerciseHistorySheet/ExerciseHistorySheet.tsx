import { useEffect, useState } from "react";
import { BottomSheet } from "~/components/BottomSheet";
import {
  createHistorySessionViewModels,
  exerciseHistoryResponseSchema,
  type HistorySessionViewModel,
} from "../../view-models/exercise-history-sheet.view-model";
import "./ExerciseHistorySheet.css";

interface ExerciseHistorySheetProps {
  readonly open: boolean;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly isBodyweight: boolean;
  readonly onClose: () => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
}

type HistoryState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "loaded";
      readonly sessions: ReadonlyArray<HistorySessionViewModel>;
    };

/** Recent finished sessions of one exercise. */
export function ExerciseHistorySheet({
  open,
  exerciseId,
  exerciseName,
  isBodyweight,
  onClose,
  onCloseAutoFocus,
}: ExerciseHistorySheetProps) {
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setHistory({ status: "loading" });
    const params = new URLSearchParams({ exerciseId, limit: "10" });
    fetch(`/api/exercises/history?${params}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        const parsed = exerciseHistoryResponseSchema.safeParse(body);
        setHistory(
          parsed.success
            ? {
                status: "loaded",
                sessions: createHistorySessionViewModels(
                  parsed.data,
                  isBodyweight,
                ),
              }
            : { status: "failed" },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistory({ status: "failed" });
      });
    return () => controller.abort();
  }, [open, exerciseId, isBodyweight]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={exerciseName}
      onCloseAutoFocus={onCloseAutoFocus}
      tall
      closable
    >
      {history.status === "loading" && (
        <p className="history-sheet__note">Loading history…</p>
      )}
      {history.status === "failed" && (
        <p className="history-sheet__note">History could not be loaded.</p>
      )}
      {history.status === "loaded" && history.sessions.length === 0 && (
        <p className="history-sheet__note">
          No previous workouts for this exercise.
        </p>
      )}
      {history.status === "loaded" &&
        history.sessions.map((session) => (
          <section key={session.workoutId} className="history-sheet__session">
            <header className="history-sheet__header">
              <span className="history-sheet__date">{session.dateDisplay}</span>
              <span className="history-sheet__workout">
                {session.workoutName}
              </span>
            </header>
            <ol className="history-sheet__sets">
              {session.sets.map((set) => (
                <li
                  key={set.key}
                  className={
                    set.isWarmup
                      ? "history-sheet__set history-sheet__set--warm"
                      : "history-sheet__set"
                  }
                >
                  <span className="history-sheet__no">{set.label}</span>
                  <span>
                    <b>{set.repsDisplay}</b>
                    <span className="history-sheet__muted"> × </span>
                    {set.weightDisplay}
                  </span>
                  <span className="history-sheet__muted">{set.rirDisplay}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
    </BottomSheet>
  );
}
