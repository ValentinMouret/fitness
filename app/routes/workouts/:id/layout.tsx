import { useCallback, useState } from "react";
import {
  data,
  Outlet,
  redirect,
  useFetcher,
  useFetchers,
  useNavigate,
} from "react-router";
import { z } from "zod";
import { ConfirmSheet } from "~/components/ConfirmSheet";
import { logger } from "~/logger.server";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import {
  getWorkoutSessionData,
  requireOwnedWorkout,
  runWorkoutSessionCommand,
} from "~/modules/fitness/infra/workout-session.service.server";
import { parseWorkoutSessionForm } from "~/modules/fitness/infra/workout-session-form";
import { RestBar } from "~/modules/fitness/presentation/components/RestBar";
import { WorkoutSummaryDialog } from "~/modules/fitness/presentation/components/WorkoutSummaryDialog";
import { useRestTimer } from "~/modules/fitness/presentation/hooks/useRestTimer";
import {
  applySetPatches,
  createActiveWorkoutViewModel,
  type SetPatch,
  toActiveWorkoutState,
} from "~/modules/fitness/presentation/view-models/active-workout.view-model";
import { createExerciseOptionViewModels } from "~/modules/fitness/presentation/view-models/exercise-option.view-model";
import { pendingSetPatch } from "~/modules/fitness/presentation/view-models/pending-set-patch";
import { formatClock } from "~/time";
import { createNotFoundError } from "~/utils/errors";
import type { Route } from "./+types/layout";
import type { WorkoutContext } from "./workout-context";
import "./active-workout.css";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  if (!z.uuid().safeParse(params.id).success)
    throw createNotFoundError("Workout");
  // Links from before the exercise screens became routes used ?exercise=.
  const focused = new URL(request.url).searchParams.get("exercise");
  if (focused && z.uuid().safeParse(focused).success)
    throw redirect(`/workouts/${params.id}/exercises/${focused}`);
  const { workoutSession, exercises, lastPerformed } =
    await getWorkoutSessionData(
      context.get(authenticatedUserContext).id,
      params.id,
    );
  return {
    state: toActiveWorkoutState(workoutSession),
    exerciseOptions: createExerciseOptionViewModels(
      exercises,
      lastPerformed,
      new Set(workoutSession.exerciseGroups.map((group) => group.exercise.id)),
    ),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const workoutId = z.uuid().safeParse(params.id);
  if (!workoutId.success) throw createNotFoundError("Workout");
  const userId = context.get(authenticatedUserContext).id;
  await requireOwnedWorkout(userId, workoutId.data);
  const command = parseWorkoutSessionForm(
    workoutId.data,
    await request.formData(),
  );
  if (command.isErr()) return data({ error: command.error }, { status: 400 });
  try {
    const result = await runWorkoutSessionCommand(
      userId,
      workoutId.data,
      command.value,
    );
    if (result instanceof Response || !("error" in result)) return result;
    return data(result, { status: 422 });
  } catch (error) {
    if (error instanceof Response) throw error;
    logger.error({ err: error }, "Workout action error");
    return data({ error: "Internal server error" }, { status: 500 });
  }
}

const isSuccess = (value: unknown) =>
  z.object({ success: z.literal(true) }).safeParse(value).success;
const hasError = (value: unknown) =>
  z.object({ error: z.string() }).safeParse(value).success;

export default function WorkoutLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const rest = useRestTimer();
  const finisher = useFetcher();
  const fetchers = useFetchers();
  const actionPath = `/workouts/${loaderData.state.id}`;

  const patches = fetchers
    .map((fetcher) => pendingSetPatch(fetcher.formData))
    .filter((patch): patch is SetPatch => patch !== undefined);
  const workout = createActiveWorkoutViewModel(
    applySetPatches(loaderData.state, patches),
  );

  const [isConfirmingFinish, setIsConfirmingFinish] = useState(false);
  const requestFinish = useCallback(() => setIsConfirmingFinish(true), []);
  const finish = () => {
    setIsConfirmingFinish(false);
    rest.dismiss();
    finisher.submit(
      { intent: "complete-workout" },
      { method: "post", action: actionPath },
    );
  };
  const setsLeft = workout.totalSets - workout.completedSets;

  const isFinished = finisher.state === "idle" && isSuccess(finisher.data);
  // Failed submissions do not revalidate, so say so until dismissed.
  const [dismissedErrors, setDismissedErrors] = useState<
    ReadonlyArray<unknown>
  >([]);
  const failure = fetchers.find(
    (fetcher) =>
      fetcher.state === "idle" &&
      hasError(fetcher.data) &&
      !dismissedErrors.includes(fetcher.data),
  );

  const context: WorkoutContext = {
    workout,
    isComplete: workout.stop !== undefined,
    exerciseOptions: loaderData.exerciseOptions,
    actionPath,
    rest,
    requestFinish,
  };

  const durationSeconds =
    ((workout.stop ? Date.parse(workout.stop) : Date.now()) -
      Date.parse(workout.start)) /
    1000;

  return (
    <>
      <Outlet context={context} />
      {!context.isComplete && <RestBar timer={rest} />}
      <ConfirmSheet
        open={isConfirmingFinish}
        title="Finish workout?"
        description={
          setsLeft === 0
            ? "Every set is done."
            : `${setsLeft} ${setsLeft === 1 ? "set is" : "sets are"} not done yet. They stay unfinished.`
        }
        confirmLabel="Finish workout"
        cancelLabel="Keep training"
        onConfirm={finish}
        onCancel={() => setIsConfirmingFinish(false)}
      />
      {failure && (
        <div className="active-workout-error" role="alert">
          <p>That change could not be saved. Try again.</p>
          <button
            type="button"
            className="active-workout-error__dismiss"
            onClick={() =>
              setDismissedErrors((previous) => [...previous, failure.data])
            }
          >
            Dismiss
          </button>
        </div>
      )}
      <WorkoutSummaryDialog
        open={isFinished}
        workoutName={workout.name}
        durationDisplay={formatClock(durationSeconds)}
        completedSets={workout.completedSets}
        totalSets={workout.totalSets}
        completedExercises={workout.completedExercises}
        totalExercises={workout.exercises.length}
        onDone={() => navigate("/dashboard")}
      />
    </>
  );
}
