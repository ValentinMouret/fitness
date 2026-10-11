import { err, ok } from "neverthrow";
import { Workout } from "../domain/workout";
import {
  type AddExercise,
  type AppendSet,
  type CompleteSet,
  type CreateExercise,
  type CreateWorkout,
  type DeleteSets,
  type FinishWorkout,
  failure,
  makeSet,
  type PatchSet,
  type RenameWorkout,
  type ReplaceExercise,
  replaceSessionExercise,
  type SaveSets,
  type WorkoutExercise,
  type WorkoutId,
} from "../domain/workout-commands";
import type { IWorkoutRepository } from "./workout.repository";

export function workoutOperations(
  repository: Pick<
    IWorkoutRepository,
    "createSession" | "changeSession" | "deleteSession" | "createExercise"
  >,
  now: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID(),
) {
  return {
    createExercise: (input: CreateExercise) => repository.createExercise(input),
    createWorkout: (data: CreateWorkout) =>
      repository.createSession(
        (catalogue) => {
          const start = data.start ? new Date(data.start) : now();
          const stop = data.stop ? new Date(data.stop) : undefined;
          if (start > now() || (stop && (stop < start || stop > now())))
            return err(
              failure(
                "invalid_input",
                "Workout times must be in the past or present, with stop at or after start",
              ),
            );
          const workout = {
            ...Workout.create({
              name: data.name,
              start,
              notes: data.notes ?? undefined,
            }),
            id: newId(),
            stop,
          };
          const exerciseGroups = [];
          for (const [orderIndex, entry] of data.exercises.entries()) {
            const exercise = catalogue.find(
              (exercise) => exercise.id === entry.exerciseId,
            );
            if (!exercise)
              return err(
                failure(
                  "not_found",
                  `Exercise ${entry.exerciseId} does not exist`,
                ),
              );
            const sets = [];
            for (const set of entry.sets) {
              const built = makeSet(workout.id, exercise.id, set);
              if (built.isErr()) return err(built.error);
              sets.push(built.value);
            }
            exerciseGroups.push({
              exercise,
              sets,
              notes: entry.notes ?? undefined,
              orderIndex,
            });
          }
          return ok({ workout, exerciseGroups });
        },
        data.exercises.map((entry) => entry.exerciseId),
      ),
    deleteWorkout: ({ workoutId }: WorkoutId) =>
      repository.deleteSession(workoutId),
    finishWorkout: ({ workoutId, stop }: FinishWorkout) =>
      repository.changeSession(workoutId, (session) => {
        if (session.workout.stop) return ok(session);
        const end = stop ? new Date(stop) : now();
        if (end < session.workout.start || end > now())
          return err(
            failure(
              "invalid_input",
              "Stop must be at or after start and not in the future",
            ),
          );
        return ok({ ...session, workout: { ...session.workout, stop: end } });
      }),
    addExercise: (data: AddExercise) =>
      repository.changeSession(
        data.workoutId,
        (session, catalogue) => {
          if (
            session.exerciseGroups.some(
              (group) => group.exercise.id === data.exerciseId,
            )
          )
            return err(
              failure("conflict", "Exercise is already in this workout"),
            );
          const exercise = catalogue.find(
            (entry) => entry.id === data.exerciseId,
          );
          if (!exercise)
            return err(failure("not_found", "Exercise does not exist"));
          const sets = [];
          for (const input of data.sets) {
            const set = makeSet(data.workoutId, data.exerciseId, input);
            if (set.isErr()) return err(set.error);
            sets.push(set.value);
          }
          return ok({
            ...session,
            exerciseGroups: [
              ...session.exerciseGroups,
              {
                exercise,
                sets,
                notes: data.notes ?? undefined,
                orderIndex:
                  Math.max(
                    -1,
                    ...session.exerciseGroups.map((group) => group.orderIndex),
                  ) + 1,
              },
            ],
          });
        },
        [data.exerciseId],
      ),
    removeExercise: ({ workoutId, exerciseId }: WorkoutExercise) =>
      repository.changeSession(workoutId, (session) => {
        if (
          !session.exerciseGroups.some(
            (group) => group.exercise.id === exerciseId,
          )
        )
          return err(failure("not_found", "Exercise is not in this workout"));
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.filter(
            (group) => group.exercise.id !== exerciseId,
          ),
        });
      }),
    replaceExercise: ({
      workoutId,
      oldExerciseId,
      newExerciseId,
    }: ReplaceExercise) =>
      repository.changeSession(
        workoutId,
        (session, catalogue) => {
          const replacement = catalogue.find(
            (exercise) => exercise.id === newExerciseId,
          );
          if (!replacement)
            return err(
              failure("not_found", "Replacement exercise does not exist"),
            );
          return replaceSessionExercise(session, oldExerciseId, replacement);
        },
        [newExerciseId],
      ),
    saveSets: ({ workoutId, exerciseId, sets }: SaveSets) =>
      repository.changeSession(workoutId, (session) => {
        const group = session.exerciseGroups.find(
          (group) => group.exercise.id === exerciseId,
        );
        if (!group)
          return err(failure("not_found", "Exercise is not in this workout"));
        const saved = new Map(group.sets.map((set) => [set.set, set]));
        for (const input of sets) {
          const set = makeSet(workoutId, exerciseId, input);
          if (set.isErr()) return err(set.error);
          saved.set(input.set, set.value);
        }
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.map((entry) =>
            entry === group
              ? {
                  ...group,
                  sets: [...saved.values()].sort((a, b) => a.set - b.set),
                }
              : entry,
          ),
        });
      }),
    deleteSets: ({ workoutId, exerciseId, sets }: DeleteSets) =>
      repository.changeSession(workoutId, (session) => {
        const group = session.exerciseGroups.find(
          (group) => group.exercise.id === exerciseId,
        );
        if (
          !group ||
          sets.some((number) => !group.sets.some((set) => set.set === number))
        )
          return err(failure("not_found", "One or more sets do not exist"));
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.map((entry) =>
            entry === group
              ? {
                  ...group,
                  sets: group.sets.filter((set) => !sets.includes(set.set)),
                }
              : entry,
          ),
        });
      }),
    renameWorkout: ({ workoutId, name }: RenameWorkout) =>
      repository.changeSession(workoutId, (session) =>
        ok({ ...session, workout: { ...session.workout, name } }),
      ),
    /** Marks a set done, logging its plan when no reps were entered. */
    completeSet: ({ workoutId, exerciseId, set }: CompleteSet) =>
      repository.changeSession(workoutId, (session) => {
        const group = session.exerciseGroups.find(
          (entry) => entry.exercise.id === exerciseId,
        );
        const existing = group?.sets.find((entry) => entry.set === set);
        if (!group || !existing)
          return err(failure("not_found", "Set does not exist"));
        const saved = makeSet(workoutId, exerciseId, {
          ...existing,
          reps: existing.reps ?? existing.targetReps,
          isCompleted: true,
        });
        if (saved.isErr()) return err(saved.error);
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.map((entry) =>
            entry === group
              ? {
                  ...entry,
                  sets: entry.sets.map((current) =>
                    current === existing ? saved.value : current,
                  ),
                }
              : entry,
          ),
        });
      }),
    /** Adds a pending set after the exercise's last set. */
    appendSet: ({ workoutId, exerciseId, targetReps, weight }: AppendSet) =>
      repository.changeSession(workoutId, (session) => {
        const group = session.exerciseGroups.find(
          (entry) => entry.exercise.id === exerciseId,
        );
        if (!group)
          return err(failure("not_found", "Exercise is not in this workout"));
        const set = makeSet(workoutId, exerciseId, {
          set: Math.max(0, ...group.sets.map((entry) => entry.set)) + 1,
          targetReps,
          weight,
          isCompleted: false,
          isWarmup: false,
          isFailure: false,
        });
        if (set.isErr()) return err(set.error);
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.map((entry) =>
            entry === group
              ? { ...group, sets: [...group.sets, set.value] }
              : entry,
          ),
        });
      }),
    updateSet: ({ workoutId, exerciseId, set, updates }: PatchSet) =>
      repository.changeSession(workoutId, (session) => {
        const group = session.exerciseGroups.find(
          (entry) => entry.exercise.id === exerciseId,
        );
        const existing = group?.sets.find((entry) => entry.set === set);
        if (!existing) return err(failure("not_found", "Set does not exist"));
        const supplied = Object.fromEntries(
          Object.entries(updates).filter(([, value]) => value !== undefined),
        );
        const saved = makeSet(workoutId, exerciseId, {
          ...existing,
          ...supplied,
        });
        if (saved.isErr()) return err(saved.error);
        return ok({
          ...session,
          exerciseGroups: session.exerciseGroups.map((entry) =>
            entry === group
              ? {
                  ...entry,
                  sets: entry.sets.map((entry) =>
                    entry === existing ? saved.value : entry,
                  ),
                }
              : entry,
          ),
        });
      }),
  };
}
