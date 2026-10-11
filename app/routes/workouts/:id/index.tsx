import { DropdownMenu } from "@radix-ui/themes";
import { MoreVertical, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExercisePickerSheet } from "~/modules/fitness/presentation/components/ExercisePickerSheet";
import { ExerciseProgressList } from "~/modules/fitness/presentation/components/ExerciseProgressList";
import { useNow } from "~/modules/fitness/presentation/hooks/useNow";
import { formatClock } from "~/time";
import { WorkoutName } from "./WorkoutName";
import { useWorkoutContext } from "./workout-context";

export default function WorkoutOverview() {
  const { workout, isComplete, exerciseOptions, actionPath, requestFinish } =
    useWorkoutContext();
  const now = useNow(isComplete ? 60_000 : 1000);
  const reorderer = useFetcher();
  const adder = useFetcher();
  const repeater = useFetcher();
  const [sheet, setSheet] = useState<"add" | "delete">();
  const headingId = useId();

  const pendingOrder = reorderer.formData?.getAll("exerciseIds").map(String);
  const exercises = pendingOrder
    ? pendingOrder.flatMap((id) => workout.exercises.filter((e) => e.id === id))
    : workout.exercises;
  const progress = workout.totalSets
    ? (workout.completedSets / workout.totalSets) * 100
    : 0;
  const end = workout.stop ? Date.parse(workout.stop) : now;
  const duration = formatClock((end - Date.parse(workout.start)) / 1000);

  const reorder = (exerciseIds: ReadonlyArray<string>) => {
    const formData = new FormData();
    formData.append("intent", "reorder-exercises");
    for (const id of exerciseIds) formData.append("exerciseIds", id);
    reorderer.submit(formData, { method: "post", action: actionPath });
  };

  return (
    <main className="active-workout">
      <header className="active-workout__header">
        <div className="active-workout__eyebrow">
          <p
            className={
              isComplete
                ? "active-workout__caps"
                : "active-workout__caps active-workout__caps--accent"
            }
          >
            {isComplete ? "Completed" : "Workout in progress"}
          </p>
          {isComplete && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button
                  type="button"
                  className="active-workout__menu"
                  aria-label="Workout actions"
                >
                  <MoreVertical size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  onSelect={() =>
                    repeater.submit(
                      { intent: "duplicate-workout" },
                      { method: "post", action: actionPath },
                    )
                  }
                >
                  Repeat workout
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  color="red"
                  onSelect={() => setSheet("delete")}
                >
                  Delete workout
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </div>
        {isComplete ? (
          <h1 className="active-workout__name">{workout.name}</h1>
        ) : (
          <WorkoutName name={workout.name} actionPath={actionPath} />
        )}
        <div className="active-workout__stats">
          <div>
            <p className="active-workout__stat-label">
              {isComplete ? "Duration" : "Elapsed"}
            </p>
            <p
              className="active-workout__stat"
              role={isComplete ? undefined : "timer"}
              // The server and the device clocks render different elapsed times.
              suppressHydrationWarning
            >
              {duration}
            </p>
          </div>
          <div className="active-workout__stats-end">
            <p className="active-workout__stat-label">Sets</p>
            <p className="active-workout__stat">
              {workout.completedSets}
              <span className="active-workout__stat-total">
                {" "}
                / {workout.totalSets}
              </span>
            </p>
          </div>
        </div>
        <div
          className="active-workout__progress"
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={workout.totalSets}
          aria-valuenow={workout.completedSets}
          aria-valuetext={`${workout.completedSets} of ${workout.totalSets} sets completed`}
        >
          <div
            className="active-workout__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <section className="active-workout__list" aria-labelledby={headingId}>
        <p id={headingId} className="active-workout__caps">
          Exercises
        </p>
        {exercises.length === 0 ? (
          <p className="active-workout__empty">
            {isComplete
              ? "No exercises were logged."
              : "No exercises yet. Add one to get started."}
          </p>
        ) : (
          <ExerciseProgressList
            exercises={exercises}
            linkTo={(exerciseId) => `${actionPath}/exercises/${exerciseId}`}
            onReorder={isComplete ? undefined : reorder}
          />
        )}
        {!isComplete && (
          <>
            <button
              type="button"
              className="active-workout__add"
              onClick={() => setSheet("add")}
            >
              <Plus size={18} />
              Add exercise
            </button>
            {workout.totalSets > 0 && (
              <button
                type="button"
                className={
                  workout.completedSets === workout.totalSets
                    ? "active-workout__finish active-workout__finish--ready"
                    : "active-workout__finish"
                }
                onClick={requestFinish}
              >
                Finish workout
              </button>
            )}
          </>
        )}
      </section>

      {!isComplete && (
        <ExercisePickerSheet
          open={sheet === "add"}
          title="Add exercise"
          options={exerciseOptions}
          onPick={(exerciseId) => {
            setSheet(undefined);
            adder.submit(
              { intent: "add-exercise", exerciseId },
              { method: "post", action: actionPath },
            );
          }}
          onClose={() => setSheet(undefined)}
        />
      )}
      {workout.stop && (
        <DeleteConfirmationDialog
          stop={new Date(workout.stop)}
          exerciseCount={workout.exercises.length}
          completedSets={workout.completedSets}
          totalSets={workout.totalSets}
          actionPath={actionPath}
          open={sheet === "delete"}
          onOpenChange={(open) => !open && setSheet(undefined)}
        />
      )}
    </main>
  );
}
