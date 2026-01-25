import { ArrowLeftIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { Link, redirect, useFetcher } from "react-router";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import { Workout, WorkoutSet } from "~/modules/fitness/domain/workout";
import { ExerciseRepository } from "~/modules/fitness/infra/repository.server";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import {
  createWorkoutExerciseCardViewModel,
  WorkoutExerciseCard,
} from "~/modules/fitness/presentation";
import { createNotFoundError, handleResultError } from "~/utils/errors";
import type { Route } from "./+types/:id";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  const workoutSessionResult = await WorkoutSessionRepository.findById(id);

  if (workoutSessionResult.isErr()) {
    handleResultError(workoutSessionResult, "Failed to load workout");
  }

  if (!workoutSessionResult.value) {
    throw createNotFoundError("Workout");
  }

  const exercisesResult = await ExerciseRepository.listAll();

  if (exercisesResult.isErr()) {
    handleResultError(exercisesResult, "Failed to load exercises");
  }

  return {
    workoutSession: workoutSessionResult.value,
    exercises: exercisesResult.value,
  };
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
        const name = formData.get("name")?.toString();

        if (!name || !name.trim()) {
          return { error: "Name is required" };
        }

        const workoutResult = await WorkoutRepository.findById(id);
        if (workoutResult.isErr() || !workoutResult.value) {
          return { error: "Workout not found" };
        }

        const updatedWorkout = { ...workoutResult.value, name: name.trim() };
        const result = await WorkoutRepository.save(updatedWorkout);

        if (result.isErr()) {
          return { error: "Failed to update workout name" };
        }

        return { success: true };
      }

      case "add-exercise": {
        const exerciseId = formData.get("exerciseId")?.toString();
        const notes = formData.get("notes")?.toString();

        if (!exerciseId) {
          return { error: "Exercise ID is required" };
        }

        const workoutSessionResult =
          await WorkoutSessionRepository.findById(id);
        if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
          return { error: "Workout not found" };
        }

        const maxOrderIndex = Math.max(
          ...workoutSessionResult.value.exerciseGroups.map((g) => g.orderIndex),
          -1,
        );

        const result = await WorkoutSessionRepository.addExercise(
          id,
          exerciseId,
          maxOrderIndex + 1,
          notes,
        );

        if (result.isErr()) {
          return { error: "Failed to add exercise" };
        }

        return { success: true };
      }

      case "remove-exercise": {
        const exerciseId = formData.get("exerciseId")?.toString();

        if (!exerciseId) {
          return { error: "Exercise ID is required" };
        }

        const result = await WorkoutSessionRepository.removeExercise(
          id,
          exerciseId,
        );

        if (result.isErr()) {
          return { error: "Failed to remove exercise" };
        }

        return { success: true };
      }

      case "add-set": {
        const exerciseId = formData.get("exerciseId")?.toString();
        const repsStr = formData.get("reps")?.toString();
        const weightStr = formData.get("weight")?.toString();
        const note = formData.get("note")?.toString();

        if (!exerciseId) {
          return { error: "Exercise ID is required" };
        }

        const workoutSessionResult =
          await WorkoutSessionRepository.findById(id);
        if (workoutSessionResult.isErr() || !workoutSessionResult.value) {
          return { error: "Workout not found" };
        }

        const exerciseGroup = workoutSessionResult.value.exerciseGroups.find(
          (g) => g.exercise.id === exerciseId,
        );
        if (!exerciseGroup) {
          return { error: "Exercise not found in workout" };
        }

        const setNumberResult =
          await WorkoutSessionRepository.getNextAvailableSetNumber(
            id,
            exerciseId,
          );
        if (setNumberResult.isErr()) {
          return { error: "Failed to determine set number" };
        }
        const setNumber = setNumberResult.value;
        const reps = repsStr ? Number.parseInt(repsStr, 10) : undefined;
        const weight = weightStr ? Number.parseFloat(weightStr) : undefined;

        if (
          repsStr &&
          reps !== undefined &&
          (Number.isNaN(reps) || reps <= 0)
        ) {
          return { error: "Reps must be a positive number" };
        }

        if (
          weightStr &&
          weight !== undefined &&
          (Number.isNaN(weight) || weight <= 0)
        ) {
          return { error: "Weight must be a positive number" };
        }

        const workoutSetResult = WorkoutSet.create({
          workout: id,
          exercise: {
            id: exerciseId,
            name: "",
            type: "barbell",
            movementPattern: "push",
          },
          set: setNumber,
          reps,
          weight,
          note,
        });

        if (workoutSetResult.isErr()) {
          return { error: "Invalid set data" };
        }

        const result = await WorkoutSessionRepository.addSet(
          workoutSetResult.value,
        );

        if (result.isErr()) {
          return { error: "Failed to add set" };
        }

        return { success: true };
      }

      case "update-set": {
        const exerciseId = formData.get("exerciseId")?.toString();
        const setNumberStr = formData.get("setNumber")?.toString();
        const repsStr = formData.get("reps")?.toString();
        const weightStr = formData.get("weight")?.toString();
        const note = formData.get("note")?.toString();
        const isCompletedStr = formData.get("isCompleted")?.toString();

        if (!exerciseId || !setNumberStr) {
          return { error: "Exercise ID and set number are required" };
        }

        const setNumber = Number.parseInt(setNumberStr, 10);
        if (Number.isNaN(setNumber) || setNumber <= 0) {
          return { error: "Set number must be a positive integer" };
        }

        const updateData: Record<string, unknown> = {};

        if (repsStr !== undefined) {
          const reps = Number.parseInt(repsStr, 10);
          if (repsStr === "" || reps === 0) {
            updateData.reps = null;
          } else if (Number.isNaN(reps) || reps < 0) {
            return { error: "Reps must be a positive number" };
          } else {
            updateData.reps = reps;
          }
        }

        if (weightStr !== undefined) {
          const weight = Number.parseFloat(weightStr);
          if (weightStr === "" || weight === 0) {
            updateData.weight = null;
          } else if (Number.isNaN(weight) || weight < 0) {
            return { error: "Weight must be a positive number" };
          } else {
            updateData.weight = weight;
          }
        }

        if (note !== undefined) {
          updateData.note = note === "" ? null : note;
        }

        if (isCompletedStr !== undefined) {
          updateData.isCompleted = isCompletedStr === "true";
        }

        const result = await WorkoutSessionRepository.updateSet(
          id,
          exerciseId,
          setNumber,
          updateData,
        );

        if (result.isErr()) {
          return { error: "Failed to update set" };
        }

        return { success: true };
      }

      case "complete-set": {
        const exerciseId = formData.get("exerciseId")?.toString();
        const setNumberStr = formData.get("setNumber")?.toString();

        if (!exerciseId || !setNumberStr) {
          return { error: "Exercise ID and set number are required" };
        }

        const setNumber = Number.parseInt(setNumberStr, 10);
        if (Number.isNaN(setNumber) || setNumber <= 0) {
          return { error: "Set number must be a positive integer" };
        }

        const result = await WorkoutSessionRepository.updateSet(
          id,
          exerciseId,
          setNumber,
          { isCompleted: true },
        );

        if (result.isErr()) {
          return { error: "Failed to complete set" };
        }

        return { success: true };
      }

      case "remove-set": {
        const exerciseId = formData.get("exerciseId")?.toString();
        const setNumberStr = formData.get("setNumber")?.toString();

        if (!exerciseId || !setNumberStr) {
          return { error: "Exercise ID and set number are required" };
        }

        const setNumber = Number.parseInt(setNumberStr, 10);
        if (Number.isNaN(setNumber) || setNumber <= 0) {
          return { error: "Set number must be a positive integer" };
        }

        const result = await WorkoutSessionRepository.removeSet(
          id,
          exerciseId,
          setNumber,
        );

        if (result.isErr()) {
          return { error: "Failed to remove set" };
        }

        return { success: true };
      }

      case "complete-workout": {
        const workoutResult = await WorkoutRepository.findById(id);
        if (workoutResult.isErr() || !workoutResult.value) {
          return { error: "Workout not found" };
        }

        const completedWorkout = { ...workoutResult.value, stop: new Date() };
        const result = await WorkoutRepository.save(completedWorkout);

        if (result.isErr()) {
          return { error: "Failed to complete workout" };
        }

        return redirect("/dashboard");
      }

      case "cancel-workout": {
        const result = await WorkoutRepository.delete(id);

        if (result.isErr()) {
          return { error: "Failed to cancel workout" };
        }

        return redirect("/workouts");
      }

      case "delete-workout": {
        const result = await WorkoutRepository.delete(id);

        if (result.isErr()) {
          return { error: "Failed to delete workout" };
        }

        return redirect("/workouts");
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

  return (
    <Box style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <Box px="4" py="4" style={{ borderBottom: "1px solid var(--gray-4)" }}>
        <Flex justify="between" align="center">
          <Flex align="center" gap="3">
            <IconButton asChild variant="ghost" size="2">
              <Link to="/workouts">
                <ArrowLeftIcon />
              </Link>
            </IconButton>
            <Box>
              {isEditingName ? (
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
                  size="5"
                  mb="1"
                  onClick={() => !isComplete && setIsEditingName(true)}
                  style={{ cursor: isComplete ? undefined : "pointer" }}
                >
                  {optimisticName}
                </Heading>
              )}
              <Text size="2" color="gray">
                {isComplete
                  ? `${formatDate(workoutSession.workout.start)} · ${formattedDuration}`
                  : `${formatDate(workoutSession.workout.start)} · ${startedAgo}`}
              </Text>
            </Box>
          </Flex>

          <Flex align="center" gap="2">
            {isComplete ? (
              <Button
                variant="soft"
                color="red"
                size="2"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete
              </Button>
            ) : (
              <>
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
              </>
            )}
          </Flex>
        </Flex>
      </Box>

      {/* Content */}
      <Box px="4">
        {workoutSession.exerciseGroups.map((group) => {
          const viewModel = createWorkoutExerciseCardViewModel(
            group,
            isComplete,
          );
          return (
            <WorkoutExerciseCard
              key={group.exercise.id}
              viewModel={viewModel}
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
    </Box>
  );
}
