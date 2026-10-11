import { useEffect, useId, useRef, useState } from "react";
import {
  type ActiveWorkoutPatch,
  type ActiveWorkoutSnapshot,
  activeWorkoutPatchSchema,
} from "~/modules/fitness/domain/active-workout";
import { ActiveWorkoutRest, formatWorkoutClock } from "./ActiveWorkoutRest";
import {
  ActiveWorkoutSet,
  draftForSet,
  type SnapshotSet,
} from "./ActiveWorkoutSet";
import "./ActiveWorkout.css";
export interface ActiveWorkoutProps {
  readonly snapshot: ActiveWorkoutSnapshot;
  readonly onRefresh: () => Promise<ActiveWorkoutSnapshot>;
  readonly onPatch: (
    input: Pick<ActiveWorkoutPatch, "exerciseId" | "set" | "updates">,
    expectedRevision: string,
  ) => Promise<ActiveWorkoutSnapshot>;
  readonly onFinish: (
    expectedRevision: string,
  ) => Promise<ActiveWorkoutSnapshot>;
  readonly onOpenFitness: () => void;
}

import { mergeDraft, type PendingDraft } from "./active-workout-draft";

type Rest = Readonly<{
  exerciseId: string;
  set: number;
  end: number;
  duration: number;
}>;
export function ActiveWorkout({
  snapshot: incoming,
  onRefresh,
  onPatch,
  onFinish,
  onOpenFitness,
}: ActiveWorkoutProps) {
  const finishTitleId = useId();
  const finishDialog = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState(incoming);
  const [currentId, setCurrentId] = useState(
    incoming.exerciseGroups[0]?.exercise.id,
  );
  const [drafts, setDrafts] = useState<Readonly<Record<string, PendingDraft>>>(
    {},
  );
  const [compact, setCompact] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const busy = useRef(false);
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setSnapshot(incoming);
  }, [incoming]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const dialog = finishDialog.current;
    if (confirmFinish && !snapshot.workout.stop && !compact) {
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [confirmFinish, snapshot.workout.stop, compact]);
  const groups = snapshot.exerciseGroups;
  const currentIndex = Math.max(
    0,
    groups.findIndex((group) => group.exercise.id === currentId),
  );
  const group = groups[currentIndex];
  const sets = groups.flatMap((item) => item.sets);
  const done = sets.filter((set) => set.isCompleted).length;
  const stopped = snapshot.workout.stop !== null;
  const remaining = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;
  const elapsed = Math.max(
    0,
    ((snapshot.workout.stop ? Date.parse(snapshot.workout.stop) : now) -
      Date.parse(snapshot.workout.start)) /
      1000,
  );
  const restStart = (exerciseId: string, set: number) => {
    const end = Date.now() + 90000;
    setNow(Date.now());
    setRest({ exerciseId, set, end, duration: 90 });
  };
  const adjustRest = (seconds: number) => {
    setNow(Date.now());
    setRest((value) =>
      value
        ? {
            ...value,
            end: Math.max(Date.now(), value.end + seconds * 1000),
            duration: Math.max(1, value.duration + seconds),
          }
        : null,
    );
  };
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not confirm the result. Refresh before trying again; your inputs are kept.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const save = (set: SnapshotSet) => {
    if (!group || stopped || requiresRefresh) return;
    const exerciseId = group.exercise.id;
    const key = `${exerciseId}:${set.set}`;
    const stored = drafts[key];
    if (stored && stored.revision !== snapshot.revision) {
      setError(
        "Saved workout values changed. Review the comparison, then keep your edits or reset them before saving.",
      );
      return;
    }
    const draft = mergeDraft(stored, set);
    const baseline = stored?.baseline ?? draftForSet(set);
    const updates = {
      ...(!set.isCompleted || draft.reps !== baseline.reps
        ? { reps: draft.reps.trim() === "" ? null : Number(draft.reps) }
        : {}),
      ...(draft.weight !== baseline.weight
        ? {
            weight:
              draft.weight.trim() === ""
                ? null
                : Number(draft.weight.replace(",", ".")),
          }
        : {}),
      ...(!set.isWarmup && draft.reportedRir !== baseline.reportedRir
        ? { reportedRir: draft.reportedRir || null }
        : {}),
      ...(!set.isCompleted ? { isCompleted: true } : {}),
    };
    if (set.isCompleted && Object.keys(updates).length === 0) return;
    const parsed = activeWorkoutPatchSchema.safeParse({
      workoutId: snapshot.workout.id,
      expectedRevision: snapshot.revision,
      exerciseId,
      set: set.set,
      updates,
    });
    if (!parsed.success || parsed.data.updates.reps === null) {
      setError(
        "Enter positive whole reps and a positive weight, or leave weight empty for an unweighted set.",
      );
      return;
    }
    void run(async () => {
      const next = await onPatch(
        { exerciseId, set: set.set, updates: parsed.data.updates },
        snapshot.revision,
      );
      const acknowledged = next.exerciseGroups
        .find((item) => item.exercise.id === exerciseId)
        ?.sets.find((item) => item.set === set.set);
      if (
        !acknowledged?.isCompleted ||
        (parsed.data.updates.reps !== undefined &&
          acknowledged.reps !== parsed.data.updates.reps) ||
        (parsed.data.updates.weight !== undefined &&
          acknowledged.weight !== parsed.data.updates.weight) ||
        (parsed.data.updates.reportedRir !== undefined &&
          acknowledged.reportedRir !== parsed.data.updates.reportedRir)
      ) {
        setSnapshot(next);
        setRequiresRefresh(true);
        throw new Error(
          "The saved result differs from your inputs. Your inputs are kept; refresh and review before saving again.",
        );
      }
      setSnapshot(next);
      setDrafts((value) => {
        const copy = { ...value };
        delete copy[key];
        return copy;
      });
      if (!set.isCompleted && !next.workout.stop)
        restStart(exerciseId, set.set);
    });
  };
  const finish = () => {
    if (requiresRefresh || stopped) return;
    void run(async () => {
      const next = await onFinish(snapshot.revision);
      setSnapshot(next);
      if (!next.workout.stop) {
        setRequiresRefresh(true);
        throw new Error(
          "Workout completion was not confirmed. Refresh before retrying.",
        );
      }
      setConfirmFinish(false);
      setRest(null);
    });
  };
  const refresh = () =>
    void run(async () => {
      setSnapshot(await onRefresh());
      setRequiresRefresh(false);
    });
  const timer =
    rest && !stopped ? (
      <ActiveWorkoutRest
        remaining={remaining}
        duration={rest.duration}
        next={
          group?.sets.find((set) => !set.isCompleted)
            ? `Next: set ${group.sets.find((set) => !set.isCompleted)?.set}`
            : "Choose your next exercise"
        }
        onAdjust={adjustRest}
        onSkip={() => setRest(null)}
      />
    ) : null;
  const nextSet = group?.sets.find((set) => !set.isCompleted);
  const nextCue = nextSet
    ? `${nextSet.isWarmup ? "Warm-up" : `Set ${nextSet.set}`}${nextSet.reps !== null ? ` · ${nextSet.reps} actual reps` : nextSet.targetReps !== null ? ` · target ${nextSet.targetReps} reps` : " · enter actual reps"}`
    : sets.some((set) => !set.isCompleted)
      ? "Choose the next exercise"
      : "Finish workout";
  if (stopped)
    return (
      <main className="mcp-workout mcp-completion">
        <div className="mcp-completion-badge" aria-hidden="true">
          ✓
        </div>
        <h1>Workout complete</h1>
        <p>{snapshot.workout.name}</p>
        <div className="mcp-done-stats">
          <div>
            <strong>{formatWorkoutClock(elapsed)}</strong>
            <span>Duration</span>
          </div>
          <div>
            <strong>
              {done}
              <small> / {sets.length}</small>
            </strong>
            <span>Sets logged</span>
          </div>
          <div>
            <strong>
              {
                groups.filter(
                  (item) =>
                    item.sets.length > 0 &&
                    item.sets.every((set) => set.isCompleted),
                ).length
              }
              <small> / {groups.length}</small>
            </strong>
            <span>Exercises completed</span>
          </div>
        </div>
        {error && (
          <p className="mcp-error" role="alert">
            {error}
          </p>
        )}
        <div className="mcp-tools">
          <button type="button" disabled={pending} onClick={refresh}>
            Refresh
          </button>
          <button type="button" onClick={onOpenFitness}>
            Open Fitness
          </button>
        </div>
      </main>
    );
  if (compact)
    return (
      <main className="mcp-workout mcp-workout--compact">
        <div className="mcp-capsule-ring" aria-hidden="true">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <title>Workout progress</title>
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              opacity=".2"
            />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--tomato-9)"
              strokeWidth="4"
              strokeDasharray="113.1"
              strokeDashoffset={
                113.1 *
                (1 -
                  (rest
                    ? Math.min(1, Math.max(0, 1 - remaining / rest.duration))
                    : done / Math.max(sets.length, 1)))
              }
            />
          </svg>
          <span>{rest ? "◷" : "✓"}</span>
        </div>
        <div className="mcp-capsule-text">
          <strong>
            {rest
              ? remaining > 0
                ? `Rest ${formatWorkoutClock(remaining)}`
                : "Rest over"
              : (group?.exercise.name ?? "No exercises")}
          </strong>
          <p>
            {snapshot.workout.name} · Next: {nextCue}
          </p>
        </div>
        <div className="mcp-capsule-actions">
          {rest && (
            <>
              <button
                type="button"
                aria-label="Reduce rest by 15 seconds"
                onClick={() => adjustRest(-15)}
              >
                −15
              </button>
              <button
                type="button"
                aria-label="Add 15 seconds rest"
                onClick={() => adjustRest(15)}
              >
                +15
              </button>
              <button type="button" onClick={() => setRest(null)}>
                {remaining > 0 ? "Skip" : "Dismiss"}
              </button>
            </>
          )}
          <button type="button" onClick={() => setCompact(false)}>
            Open
          </button>
          {error && (
            <button type="button" disabled={pending} onClick={refresh}>
              Refresh
            </button>
          )}
        </div>
        {error && (
          <p className="mcp-error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <main
      className={`mcp-workout ${compact && !stopped ? "mcp-workout--compact" : ""}`}
    >
      <header className="mcp-header">
        <div>
          <p className="mcp-caption">Workout in progress</p>
          <h1>{snapshot.workout.name}</h1>
        </div>
        <div className="mcp-header-stats">
          <div>
            <span className="mcp-caption">Elapsed</span>
            <strong>{formatWorkoutClock(elapsed)}</strong>
          </div>
          <div>
            <span className="mcp-caption">Sets</span>
            <strong>
              {done}
              <span> / {sets.length}</span>
            </strong>
          </div>
        </div>
        <progress
          aria-label="Workout set completion"
          max={Math.max(sets.length, 1)}
          value={done}
        />
      </header>
      {error && (
        <p className="mcp-error" role="alert">
          {error}
        </p>
      )}
      <div className="mcp-tools">
        <button type="button" disabled={pending} onClick={refresh}>
          {pending ? "Working…" : "Refresh"}
        </button>
        {!stopped && (
          <button type="button" onClick={() => setCompact(!compact)}>
            {compact ? "Expand" : "Compact"}
          </button>
        )}
        <button type="button" onClick={onOpenFitness}>
          Open Fitness
        </button>
      </div>
      {group ? (
        <section className="mcp-exercise">
          <div className="mcp-exercise-title">
            <h2>{group.exercise.name}</h2>
            <span>
              {currentIndex + 1} / {groups.length}
            </span>
          </div>
          {group.exercise.mmcInstructions && (
            <div className="mcp-coaching">
              <span className="mcp-caption">Mind–muscle connection</span>
              <p>{group.exercise.mmcInstructions}</p>
            </div>
          )}
          {group.notes && <p className="mcp-notes">{group.notes}</p>}
          <div className="mcp-set-grid mcp-columns" aria-hidden="true">
            <span>Set</span>
            <span>Actual reps</span>
            <span>Actual weight</span>
            <span>RIR</span>
            <span />
          </div>
          <p className="mcp-target-explanation">
            Dashed values are targets. Enter actual results to log.
          </p>
          <div className="mcp-sets">
            {group.sets.map((set) => {
              const key = `${group.exercise.id}:${set.set}`;
              return (
                <div
                  key={key}
                  className={
                    set.set ===
                    group.sets.find((item) => !item.isCompleted)?.set
                      ? "mcp-next-set"
                      : undefined
                  }
                >
                  <ActiveWorkoutSet
                    set={set}
                    draft={mergeDraft(drafts[key], set)}
                    pending={pending}
                    stopped={stopped || requiresRefresh}
                    onChange={(draft) =>
                      setDrafts((value) => ({
                        ...value,
                        [key]: {
                          values: draft,
                          baseline: value[key]?.baseline ?? draftForSet(set),
                          revision: value[key]?.revision ?? snapshot.revision,
                        },
                      }))
                    }
                    onSave={() => save(set)}
                    dirty={Boolean(drafts[key])}
                    onCancel={() =>
                      setDrafts((value) => {
                        const copy = { ...value };
                        delete copy[key];
                        return copy;
                      })
                    }
                  />
                  {drafts[key] &&
                    drafts[key].revision !== snapshot.revision && (
                      <section
                        className="mcp-draft-conflict"
                        aria-label={`Set ${set.set} changed saved values`}
                      >
                        <p>
                          Saved values changed. Current saved: {set.reps ?? "—"}{" "}
                          reps, {set.weight ?? "unweighted"} kg, RIR{" "}
                          {set.reportedRir ?? "unreported"}. Before editing:{" "}
                          {drafts[key].baseline.reps || "—"} reps,{" "}
                          {drafts[key].baseline.weight || "unweighted"} kg, RIR{" "}
                          {drafts[key].baseline.reportedRir || "unreported"}.
                        </p>
                        <p>
                          Your edited inputs are shown above. Keeping them will
                          reapply only fields you changed.
                        </p>
                        <button
                          type="button"
                          disabled={pending || stopped}
                          onClick={() =>
                            setDrafts((value) => {
                              const old = value[key];
                              return old
                                ? {
                                    ...value,
                                    [key]: {
                                      values: mergeDraft(old, set),
                                      baseline: draftForSet(set),
                                      revision: snapshot.revision,
                                    },
                                  }
                                : value;
                            })
                          }
                        >
                          Keep my edits
                        </button>
                      </section>
                    )}
                  {rest?.exerciseId === group.exercise.id &&
                    rest.set === set.set &&
                    timer}
                </div>
              );
            })}
          </div>
          {group.sets.length === 0 && (
            <p>No sets planned. Open Fitness to add sets.</p>
          )}
          {rest && rest.exerciseId !== group.exercise.id && timer}
        </section>
      ) : (
        <p className="mcp-notes">
          No exercises planned. Open Fitness to add exercises.
        </p>
      )}
      <nav className="mcp-navigation" aria-label="Exercise navigation">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentId(groups[currentIndex - 1]?.exercise.id)}
        >
          ← Previous<span>{groups[currentIndex - 1]?.exercise.name}</span>
        </button>
        <button
          type="button"
          disabled={currentIndex >= groups.length - 1}
          onClick={() => setCurrentId(groups[currentIndex + 1]?.exercise.id)}
        >
          Next →<span>{groups[currentIndex + 1]?.exercise.name}</span>
        </button>
      </nav>
      <button
        type="button"
        className="mcp-finish"
        disabled={pending || requiresRefresh}
        onClick={() => setConfirmFinish(true)}
      >
        Finish workout
      </button>
      {!stopped && (
        <dialog
          ref={finishDialog}
          className="mcp-finish-confirm"
          aria-labelledby={finishTitleId}
          onCancel={(event) => {
            event.preventDefault();
            if (!pending) setConfirmFinish(false);
          }}
        >
          <h2 id={finishTitleId}>Finish workout?</h2>
          {error && (
            <p className="mcp-error" role="alert">
              {error}
            </p>
          )}
          {requiresRefresh && (
            <button type="button" disabled={pending} onClick={refresh}>
              Refresh
            </button>
          )}
          <p>
            {sets.length - done > 0
              ? `${sets.length - done} ${sets.length - done === 1 ? "set is" : "sets are"} not logged. Their actual values will remain unchanged.`
              : "All sets are logged."}
            {Object.keys(drafts).length > 0 &&
              " Unsaved inputs will not be submitted."}
          </p>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmFinish(false)}
            >
              Keep working
            </button>
            <button
              type="button"
              disabled={pending || requiresRefresh}
              onClick={finish}
            >
              Confirm finish
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
