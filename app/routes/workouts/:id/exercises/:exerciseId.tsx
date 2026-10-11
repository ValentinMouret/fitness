import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  Navigate,
  useFetchers,
  useNavigation,
  useParams,
  useSubmit,
} from "react-router";
import { ConfirmSheet } from "~/components/ConfirmSheet";
import type { ReportedRir } from "~/modules/fitness/domain/workout";
import { EditMMCModal } from "~/modules/fitness/presentation";
import { ActiveSetRow } from "~/modules/fitness/presentation/components/ActiveSetRow";
import { ExerciseHistorySheet } from "~/modules/fitness/presentation/components/ExerciseHistorySheet";
import { ExercisePickerSheet } from "~/modules/fitness/presentation/components/ExercisePickerSheet";
import { RirSheet } from "~/modules/fitness/presentation/components/RirSheet";
import { restSecondsFor } from "~/modules/fitness/presentation/rest-timer/rest-timer";
import type { ActiveSetViewModel } from "~/modules/fitness/presentation/view-models/active-workout.view-model";
import { useWorkoutContext } from "../workout-context";

/** The exercise screen has its own navigation, so the tab bar is hidden. */
export const handle = { hidesTabBar: () => true };

/**
 * Submissions in the same group for the same set supersede each other; other
 * groups run independently so unrelated edits never cancel one another.
 */
type SubmissionGroup =
  | "completion"
  | "effort"
  | "warmup"
  | "reps"
  | "weight"
  | "add-set"
  | "remove-set"
  | "exercise";

type Sheet =
  | { readonly kind: "history" | "remove" | "replace" | "cue" }
  | {
      readonly kind: "rir";
      readonly setNumber: number;
      /** Ask to finish the workout once the RIR is answered. */
      readonly finishAfter: boolean;
    };

export default function ExerciseScreen() {
  const { exerciseId } = useParams();
  const {
    workout,
    isComplete,
    exerciseOptions,
    actionPath,
    rest,
    requestFinish,
  } = useWorkoutContext();
  const submitForm = useSubmit();
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const [sheet, setSheet] = useState<Sheet>();

  const index = workout.exercises.findIndex((e) => e.id === exerciseId);
  const exercise = workout.exercises[index];
  if (!exercise) {
    // A replaced or removed exercise redirects through its action; only fall
    // back to the overview once nothing is pending.
    const isPending =
      navigation.state !== "idle" ||
      fetchers.some((fetcher) => fetcher.state !== "idle");
    return isPending ? null : <Navigate to={actionPath} replace />;
  }

  const previous = workout.exercises[index - 1];
  const next = workout.exercises[index + 1];
  const rirSet =
    sheet?.kind === "rir"
      ? exercise.sets.find((set) => set.setNumber === sheet.setNumber)
      : undefined;
  const logged = exercise.sets.filter((set) => set.isCompleted).length;

  const submit = (group: SubmissionGroup, fields: Record<string, string>) =>
    submitForm(
      { exerciseId: exercise.id, ...fields },
      {
        method: "post",
        action: actionPath,
        navigate: false,
        fetcherKey: [exercise.id, fields.setNumber ?? "", group].join(":"),
      },
    );
  const updateSet = (
    group: SubmissionGroup,
    setNumber: number,
    fields: Record<string, string>,
  ) =>
    submit(group, {
      intent: "update-set",
      setNumber: String(setNumber),
      ...fields,
    });
  const restSource = (set: ActiveSetViewModel) =>
    `${exercise.id}:${set.setNumber}`;

  const toggleComplete = (set: ActiveSetViewModel) => {
    if (set.isCompleted) {
      // Effort belongs to completed working sets, so clear it explicitly.
      updateSet("completion", set.setNumber, {
        isCompleted: "false",
        reportedRir: "",
      });
      rest.cancel(restSource(set));
      return;
    }
    // The server logs the plan if no reps were saved, so a stale client
    // value can never overwrite reps that were just entered.
    submit("completion", {
      intent: "complete-set",
      setNumber: String(set.setNumber),
    });
    const setsLeft = workout.totalSets - workout.completedSets - 1;
    if (setsLeft > 0)
      rest.start(
        restSecondsFor(set.isWarmup, rest.defaultSeconds),
        restSource(set),
      );
    if (!set.isWarmup)
      setSheet({
        kind: "rir",
        setNumber: set.setNumber,
        finishAfter: setsLeft === 0,
      });
    else if (setsLeft === 0) requestFinish();
  };

  const closeRir = (rir?: ReportedRir) => {
    if (sheet?.kind !== "rir") return;
    // Sent with the completion so it cannot reach the server before the tick.
    if (rir !== undefined)
      updateSet("effort", sheet.setNumber, {
        reportedRir: rir,
        isCompleted: "true",
      });
    setSheet(undefined);
    if (sheet.finishAfter) requestFinish();
  };

  const addSetKey = [exercise.id, "", "add-set" satisfies SubmissionGroup].join(
    ":",
  );
  const isAddingSet = fetchers.some(
    (fetcher) => fetcher.key === addSetKey && fetcher.state !== "idle",
  );

  const addSet = () => {
    const last = exercise.sets.at(-1);
    const targetReps = last?.reps.value ?? last?.reps.target;
    const weight = last?.weight.value;
    submit("add-set", {
      intent: "add-set",
      ...(targetReps === undefined ? {} : { targetReps: String(targetReps) }),
      ...(weight === undefined ? {} : { weight: String(weight) }),
    });
  };

  return (
    <main className="exercise-screen">
      <div className="exercise-screen__scroll">
        <nav className="exercise-screen__topbar" aria-label="Exercise">
          <Link to={actionPath} className="exercise-screen__back">
            <ChevronLeft size={20} strokeWidth={2} />
            Workout
          </Link>
          <div className="exercise-screen__tools">
            <span className="exercise-screen__position">
              {index + 1} / {workout.exercises.length}
            </span>
            <button
              type="button"
              className="exercise-screen__tool exercise-screen__tool--text"
              onClick={() => setSheet({ kind: "history" })}
            >
              <Clock size={18} strokeWidth={1.8} />
              History
            </button>
            {!isComplete && (
              <>
                <button
                  type="button"
                  className="exercise-screen__tool"
                  aria-label="Replace exercise"
                  onClick={() => setSheet({ kind: "replace" })}
                >
                  <ArrowLeftRight size={19} />
                </button>
                <button
                  type="button"
                  className="exercise-screen__tool"
                  aria-label="Remove exercise"
                  onClick={() => setSheet({ kind: "remove" })}
                >
                  <Trash2 size={19} />
                </button>
              </>
            )}
          </div>
        </nav>

        <header className="exercise-screen__header">
          <h1 className="exercise-screen__name">{exercise.name}</h1>
          {isComplete ? (
            exercise.mmcInstructions && (
              <div className="exercise-screen__cue">
                <span className="active-workout__caps active-workout__caps--accent">
                  Mind–muscle connection
                </span>
                <span className="exercise-screen__cue-text">
                  {exercise.mmcInstructions}
                </span>
              </div>
            )
          ) : exercise.mmcInstructions ? (
            <button
              type="button"
              className="exercise-screen__cue"
              aria-label={`Mind–muscle connection: ${exercise.mmcInstructions}. Edit cue`}
              onClick={() => setSheet({ kind: "cue" })}
            >
              <span className="active-workout__caps active-workout__caps--accent">
                Mind–muscle connection
              </span>
              <span className="exercise-screen__cue-text">
                {exercise.mmcInstructions}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="exercise-screen__add-cue"
              onClick={() => setSheet({ kind: "cue" })}
            >
              Add mind-muscle cue
            </button>
          )}
        </header>

        <div className="active-set-table__head" aria-hidden="true">
          <span>Set</span>
          <span>Reps</span>
          <span>{exercise.isBodyweight ? "Added kg" : "Weight"}</span>
          <span />
          <span />
        </div>
        <ol className="exercise-screen__sets" aria-label="Sets">
          {exercise.sets.map((set) => (
            <ActiveSetRow
              key={set.setNumber}
              set={set}
              isBodyweight={exercise.isBodyweight}
              mode={isComplete ? "correct" : "log"}
              onChange={(field, value) =>
                updateSet(field, set.setNumber, { [field]: value })
              }
              onToggleComplete={() => toggleComplete(set)}
              onToggleWarmup={() =>
                updateSet("warmup", set.setNumber, {
                  isWarmup: String(!set.isWarmup),
                  ...(set.isWarmup || !set.isCompleted
                    ? {}
                    : { reportedRir: "" }),
                })
              }
              onRemove={() =>
                submit("remove-set", {
                  intent: "remove-set",
                  setNumber: String(set.setNumber),
                })
              }
              onEditRir={() =>
                setSheet({
                  kind: "rir",
                  setNumber: set.setNumber,
                  finishAfter: false,
                })
              }
            />
          ))}
        </ol>
        {isComplete ? (
          <p className="exercise-screen__hint">
            Saved sets can still be corrected.
          </p>
        ) : (
          <>
            <button
              type="button"
              className="active-workout__add"
              onClick={addSet}
              disabled={isAddingSet}
            >
              <Plus size={18} />
              Add set
            </button>
            <p className="exercise-screen__hint">
              Tap a set number to mark it as a warm-up.
            </p>
          </>
        )}
      </div>

      <nav className="exercise-screen__nav" aria-label="Other exercises">
        {previous ? (
          <Link
            to={`${actionPath}/exercises/${previous.id}`}
            className="exercise-screen__nav-link"
          >
            <ChevronLeft size={18} />
            <span>
              <span className="exercise-screen__nav-kind">Previous</span>
              <span className="exercise-screen__nav-name">{previous.name}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`${actionPath}/exercises/${next.id}`}
            className="exercise-screen__nav-link exercise-screen__nav-link--next"
          >
            <span>
              <span className="exercise-screen__nav-kind">Next</span>
              <span className="exercise-screen__nav-name">{next.name}</span>
            </span>
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <RirSheet
        open={rirSet !== undefined}
        current={rirSet?.reportedRir}
        onPick={closeRir}
        onClose={() => closeRir()}
      />
      <ExerciseHistorySheet
        open={sheet?.kind === "history"}
        exerciseId={exercise.id}
        exerciseName={exercise.name}
        isBodyweight={exercise.isBodyweight}
        onClose={() => setSheet(undefined)}
      />
      <ExercisePickerSheet
        open={sheet?.kind === "replace"}
        title={`Replace ${exercise.name}`}
        options={exerciseOptions}
        onPick={(newExerciseId) => {
          setSheet(undefined);
          submitForm(
            {
              intent: "replace-exercise",
              oldExerciseId: exercise.id,
              newExerciseId,
            },
            { method: "post", action: actionPath, navigate: false },
          );
        }}
        onClose={() => setSheet(undefined)}
      />
      <ConfirmSheet
        open={sheet?.kind === "remove"}
        title={`Remove ${exercise.name}?`}
        description={
          logged
            ? `${logged} logged ${logged === 1 ? "set" : "sets"} will be discarded.`
            : "It will be removed from this workout."
        }
        confirmLabel="Remove exercise"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setSheet(undefined);
          rest.dismiss();
          submit("exercise", { intent: "remove-exercise" });
        }}
        onCancel={() => setSheet(undefined)}
      />
      {sheet?.kind === "cue" && (
        <EditMMCModal
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          mmcInstructions={exercise.mmcInstructions}
          actionPath={actionPath}
          open
          onOpenChange={(open) => !open && setSheet(undefined)}
        />
      )}
    </main>
  );
}
