import { Theme } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createMemoryRouter,
  RouterProvider,
  useLoaderData,
} from "react-router";
import { WorkoutExerciseCard } from "~/modules/fitness/presentation/components/WorkoutExerciseCard/WorkoutExerciseCard";
import type { WorkoutSetViewModel } from "~/modules/fitness/presentation/view-models/workout-exercise-card.view-model";

export function mountWorkoutCompletionFixture(root: HTMLElement) {
  let submitted: FormData | undefined;
  // Capture the real form synchronously so the action can finish in one render.
  root.addEventListener(
    "submit",
    (event) => {
      if (event.target instanceof HTMLFormElement) {
        submitted = new FormData(event.target);
      }
    },
    true,
  );
  let sets: ReadonlyArray<WorkoutSetViewModel> = [1, 2].map((set) => ({
    set,
    reps: 8,
    weight: 60,
    isCompleted: false,
    isFailure: false,
    isWarmup: false,
    repsDisplay: "8",
    weightDisplay: "60",
    noteDisplay: "—",
  }));
  function Fixture() {
    const { sets } = useLoaderData<{
      readonly sets: ReadonlyArray<WorkoutSetViewModel>;
    }>();
    const [open, setOpen] = useState<string>();
    const [completed, setCompleted] = useState(0);
    const onReportPromptChange = useCallback((key: string, isOpen: boolean) => {
      setOpen((current) =>
        isOpen ? key : current === key ? undefined : current,
      );
    }, []);
    const onCompleteSet = useCallback(
      () => setCompleted((value) => value + 1),
      [],
    );
    return (
      <Theme>
        <output>Completed callbacks: {completed}</output>
        <WorkoutExerciseCard
          viewModel={{
            exerciseId: "exercise",
            exerciseName: "Bench",
            exerciseType: "barbell",
            sets,
            canAddSets: true,
            canRemoveExercise: false,
            hasCompletedSets: sets.some((set) => set.isCompleted),
            totalVolumeDisplay: "",
          }}
          openReportSetKey={open}
          onReportPromptChange={onReportPromptChange}
          onCompleteSet={onCompleteSet}
        />
      </Theme>
    );
  }
  const router = createMemoryRouter(
    [
      {
        path: "/",
        loader: () => ({ sets }),
        Component: Fixture,
        action: () => {
          const form = submitted;
          submitted = undefined;
          if (
            form?.get("intent") !== "update-set" ||
            form.get("exerciseId") !== "exercise" ||
            form.get("isCompleted") !== "true"
          ) {
            return { error: "Unexpected completion form" };
          }
          const number = Number(form.get("setNumber"));
          if (!sets.some((set) => set.set === number && !set.isCompleted)) {
            return { error: "Unknown or already completed set" };
          }
          sets = sets.map((set) =>
            set.set === number ? { ...set, isCompleted: true } : set,
          );
          return { success: true };
        },
      },
    ],
    { initialEntries: ["/"] },
  );
  createRoot(root).render(<RouterProvider router={router} />);
}
