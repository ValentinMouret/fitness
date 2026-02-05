import { Box, Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import "~/components/workout/WorkoutTimerBar.css";
import { Workout } from "~/modules/fitness/domain/workout";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { formOptionalText, formText } from "~/utils/form-data";
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
import { duplicateWorkout } from "~/modules/fitness/application/duplicate-workout.service.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;
  return getWorkoutSessionData(id);
}

export async function action({ request, params }: Route.ActionArgs) {
  const { id } = params;
  const formData = await request.formData();
  const intentSchema = zfd.formData({
    intent: formText(z.string().min(1)),
  });
  const intentParsed = intentSchema.safeParse(formData);

  if (!intentParsed.success) {
    return { error: "Intent is required" };
  }
  const intent = intentParsed.data.intent;

  try {
    switch (intent) {
      case "update-name": {
        const schema = zfd.formData({
          name: formText(z.string().min(1)),
        });
        const parsed = schema.parse(formData);
        return updateWorkoutName(id, parsed.name);
      }

      case "add-exercise": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          notes: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return addExerciseToWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          notes: parsed.notes ?? undefined,
        });
      }

      case "remove-exercise": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
        });
        const parsed = schema.parse(formData);
        return removeExerciseFromWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
        });
      }

      case "add-set": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          reps: formOptionalText(),
          weight: formOptionalText(),
          note: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return addSetToWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          repsStr: parsed.reps ?? undefined,
          weightStr: parsed.weight ?? undefined,
          note: parsed.note ?? undefined,
        });
      }

      case "update-set": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          setNumber: formText(z.string().min(1)),
          reps: formOptionalText(),
          weight: formOptionalText(),
          note: formOptionalText(),
          isCompleted: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return updateSetInWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          setNumberStr: parsed.setNumber,
          repsStr: parsed.reps ?? undefined,
          weightStr: parsed.weight ?? undefined,
          note: parsed.note ?? undefined,
          isCompletedStr: parsed.isCompleted ?? undefined,
        });
      }

      case "complete-set": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          setNumber: formText(z.string().min(1)),
        });
        const parsed = schema.parse(formData);
        return completeSetInWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          setNumberStr: parsed.setNumber,
        });
      }

      case "remove-set": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          setNumber: formText(z.string().min(1)),
        });
        const parsed = schema.parse(formData);
        return removeSetFromWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          setNumberStr: parsed.setNumber,
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

      case "duplicate-workout": {
        return duplicateWorkout(id);
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

  const { formattedDuration } = useLiveDuration({
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
        : formatDate(workoutSession.workout.start)}
    </Text>
  );

  const customRight = isComplete ? (
    <Flex gap="2">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="duplicate-workout" />
        <Button variant="soft" size="2" type="submit">
          Repeat
        </Button>
      </fetcher.Form>
      <Button
        variant="soft"
        color="red"
        size="2"
        onClick={() => setShowDeleteDialog(true)}
      >
        Delete
      </Button>
    </Flex>
  ) : undefined;

  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        backTo="/workouts"
        customRight={customRight}
      />

      {/* Sticky workout timer */}
      {!isComplete && (
        <Flex
          className="workout-timer-bar"
          align="center"
          justify="between"
          py="2"
        >
          <Flex align="center" gap="2">
            <Text
              className="workout-timer-bar__duration"
              size="4"
              weight="bold"
            >
              {formattedDuration}
            </Text>
            <Text size="2" color="gray">
              elapsed
            </Text>
          </Flex>
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
        </Flex>
      )}

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
