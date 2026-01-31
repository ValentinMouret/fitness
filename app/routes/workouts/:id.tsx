import { Box, Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import { Workout } from "~/modules/fitness/domain/workout";
import {
  createWorkoutExerciseCardViewModel,
  WorkoutExerciseCard,
} from "~/modules/fitness/presentation";
import { PageHeader } from "~/components/PageHeader";
import type { Route } from "./+types/:id";
import {
  addExerciseToWorkout,
  addSetToWorkout,
  cancelWorkout,
  completeSetInWorkout,
  completeWorkout,
  deleteWorkout,
  getWorkoutSessionData,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  updateSetInWorkout,
  updateWorkoutName,
} from "~/modules/fitness/application/workout-session.service.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;
  return getWorkoutSessionData(id);
}

export async function action({ request, params }: Route.ActionArgs) {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  if (!intent) {
    return { error: "Intent is required" };
  }

  try {
    switch (intent) {
      case "update-name": {
        return updateWorkoutName(id, formData.get("name")?.toString());
      }

      case "add-exercise": {
        return addExerciseToWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
          notes: formData.get("notes")?.toString(),
        });
      }

      case "remove-exercise": {
        return removeExerciseFromWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
        });
      }

      case "add-set": {
        return addSetToWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
          repsStr: formData.get("reps")?.toString(),
          weightStr: formData.get("weight")?.toString(),
          note: formData.get("note")?.toString(),
        });
      }

      case "update-set": {
        return updateSetInWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
          setNumberStr: formData.get("setNumber")?.toString(),
          repsStr: formData.get("reps")?.toString(),
          weightStr: formData.get("weight")?.toString(),
          note: formData.get("note")?.toString(),
          isCompletedStr: formData.get("isCompleted")?.toString(),
        });
      }

      case "complete-set": {
        return completeSetInWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
          setNumberStr: formData.get("setNumber")?.toString(),
        });
      }

      case "remove-set": {
        return removeSetFromWorkout({
          workoutId: id,
          exerciseId: formData.get("exerciseId")?.toString(),
          setNumberStr: formData.get("setNumber")?.toString(),
        });
      }

      case "complete-workout": {
        return completeWorkout({ workoutId: id });
      }

      case "cancel-workout": {
        return cancelWorkout({ workoutId: id });
      }

      case "delete-workout": {
        return deleteWorkout({ workoutId: id });
      }

      default:
        return { error: "Unknown intent" };
    }
  } catch (error) {
    console.error("Action error:", error);
    return { error: "Internal server error" };
  }
}

export default function WorkoutSession({ loaderData }: Route.ComponentProps) {
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const fetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);

  const { startedAgo, formattedDuration } = useLiveDuration({
    startTime: loaderData?.workoutSession.workout.start || new Date(),
    endTime: loaderData?.workoutSession.workout.stop || undefined,
  });

  const restTimer = useRestTimer();

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  if (!loaderData) {
    return <div>Loading...</div>;
  }

  const { workoutSession, exercises } = loaderData;
  const isComplete = Workout.isComplete.call(workoutSession.workout);

  const optimisticName =
    fetcher.formData?.get("name")?.toString() || workoutSession.workout.name;

  const handleNameSubmit = (name: string) => {
    if (name.trim() && name !== workoutSession.workout.name) {
      fetcher.submit(
        { intent: "update-name", name: name.trim() },
        { method: "post" },
      );
    }
    setIsEditingName(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const title = isEditingName ? (
    <TextField.Root
      ref={inputRef}
      defaultValue={optimisticName}
      size="3"
      onBlur={(e) => handleNameSubmit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleNameSubmit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          setIsEditingName(false);
        }
      }}
      style={{ fontWeight: "500" }}
    />
  ) : (
    <Heading
      size="7"
      onClick={() => !isComplete && setIsEditingName(true)}
      style={{ cursor: isComplete ? undefined : "pointer" }}
    >
      {optimisticName}
    </Heading>
  );

  const subtitle = (
    <Text size="2" color="gray">
      {isComplete
        ? `${formatDate(workoutSession.workout.start)} · ${formattedDuration}`
        : `${formatDate(workoutSession.workout.start)} · ${startedAgo}`}
    </Text>
  );

  const customRight = isComplete ? (
    <Button
      variant="soft"
      color="red"
      size="2"
      onClick={() => setShowDeleteDialog(true)}
    >
      Delete
    </Button>
  ) : (
    <Flex gap="2">
      <Button
        variant="soft"
        color="red"
        size="2"
        onClick={() => setShowCancelDialog(true)}
      >
        Cancel
      </Button>
      <Button size="2" onClick={() => setShowCompletionModal(true)}>
        Complete
      </Button>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        backTo="/workouts"
        customRight={customRight}
      />

      {/* Content */}
      <Box>
        {workoutSession.exerciseGroups.map((group) => {
          const viewModel = createWorkoutExerciseCardViewModel(
            group,
            isComplete,
          );
          return (
            <WorkoutExerciseCard
              key={group.exercise.id}
              viewModel={viewModel}
              onCompleteSet={() => restTimer.start()}
            />
          );
        })}

        {!isComplete && (
          <Box py="5">
            <Button
              onClick={() => setShowExerciseSelector(true)}
              size="2"
              variant="soft"
              style={{ width: "100%" }}
            >
              Add Exercise
            </Button>
          </Box>
        )}
      </Box>

      {/* Modals */}
      <ExerciseSelector
        exercises={exercises}
        open={showExerciseSelector}
        onOpenChange={setShowExerciseSelector}
      />

      <CompletionModal
        workoutSession={workoutSession}
        open={showCompletionModal}
        onOpenChange={setShowCompletionModal}
      />

      <CancelConfirmationDialog
        workoutSession={workoutSession}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      />

      {isComplete && (
        <DeleteConfirmationDialog
          workoutSession={workoutSession}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
        />
      )}

      {!isComplete && (
        <RestTimer
          isActive={restTimer.isActive}
          secondsRemaining={restTimer.secondsRemaining}
          totalSeconds={restTimer.totalSeconds}
          onDismiss={restTimer.dismiss}
          onSetDuration={restTimer.setDuration}
        />
      )}
    </Box>
  );
}
