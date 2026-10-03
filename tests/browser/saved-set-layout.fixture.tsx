import "@radix-ui/themes/styles.css";
import "~/app.css";
import { Theme } from "@radix-ui/themes";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { WorkoutExerciseCard } from "~/modules/fitness/presentation/components/WorkoutExerciseCard/WorkoutExerciseCard";
import type { WorkoutSetViewModel } from "~/modules/fitness/presentation/view-models/workout-exercise-card.view-model";

const sets: readonly WorkoutSetViewModel[] = [
  { set: 1, isWarmup: true },
  { set: 2, isWarmup: false },
  { set: 3, isWarmup: false, reportedRir: "2" as const },
  { set: 4, isWarmup: true, rpe: 8 },
].map((set) => ({
  ...set,
  weight: 6,
  reps: 7,
  isCompleted: true,
  isFailure: false,
  weightDisplay: "6",
  repsDisplay: "7",
  noteDisplay: "—",
}));

function Fixture() {
  const [open, setOpen] = useState<string>();
  const [readOnly, setReadOnly] = useState(false);
  return (
    <Theme accentColor="tomato" grayColor="sand" radius="medium">
      <button type="button" onClick={() => setReadOnly(!readOnly)}>
        {readOnly ? "View active workout" : "View completed workout"}
      </button>
      <WorkoutExerciseCard
        focused
        viewModel={{
          exerciseId: "exercise",
          exerciseName: "Saved sets",
          exerciseType: "barbell",
          sets,
          canAddSets: !readOnly,
          canRemoveExercise: false,
          hasCompletedSets: true,
          totalVolumeDisplay: "",
        }}
        openReportSetKey={open}
        onReportPromptChange={(key, isOpen) =>
          setOpen(isOpen ? key : undefined)
        }
      />
    </Theme>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(
  <RouterProvider
    router={createMemoryRouter([{ path: "/", Component: Fixture }])}
  />,
);
