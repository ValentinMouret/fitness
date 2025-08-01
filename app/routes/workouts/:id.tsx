import type { Route } from "./+types/:id";
import { redirect } from "react-router";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import { ExerciseRepository } from "~/modules/fitness/infra/repository.server";
import { WorkoutSet } from "~/modules/fitness/domain/workout";
import { Box, Heading, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useState, useRef, useEffect } from "react";
import { WorkoutExerciseCard } from "~/components/workout/WorkoutExerciseCard";
import { useFetcher } from "react-router";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { useLiveDuration } from "~/components/workout/useLiveDuration";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  const workoutSessionResult = await WorkoutSessionRepository.findById(id);

  if (workoutSessionResult.isErr()) {
    console.error("Error loading workout session:", workoutSessionResult.error);
    throw new Error("Failed to load workout");
  }

  if (!workoutSessionResult.value) {
    throw new Response("Workout not found", { status: 404 });
  }

  const exercisesResult = await ExerciseRepository.listAll();

  if (exercisesResult.isErr()) {
    console.error("Error loading exercises:", exercisesResult.error);
    throw new Error("Failed to load exercises");
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

        // Get the current max order index
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

        // Get current sets count for this exercise
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

        // Validate numbers
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
        // Load the workout to get current data
        const workoutResult = await WorkoutRepository.findById(id);
        if (workoutResult.isErr() || !workoutResult.value) {
          return { error: "Workout not found" };
        }

        // Complete the workout by setting stop time
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

      default:
        return { error: "Unknown intent" };
    }
  } catch (error) {
    console.error("Action error:", error);
    return { error: "Internal server error" };
  }
}

export default function WorkoutSession({ loaderData }: Route.ComponentProps) {
  if (!loaderData) {
    return <div>Loading...</div>;
  }

  const { workoutSession, exercises } = loaderData;
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const fetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);

  const optimisticName =
    fetcher.formData?.get("name")?.toString() || workoutSession.workout.name;

  const { startedAgo } = useLiveDuration({
    startTime: workoutSession.workout.start,
    endTime: workoutSession.workout.stop,
  });

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = (name: string) => {
    if (name.trim() && name !== workoutSession.workout.name) {
      fetcher.submit(
        { intent: "update-name", name: name.trim() },
        { method: "post" },
      );
    }
    setIsEditingName(false);
  };

  return (
    <Box p="4">
      {/* Workout Header */}
      <Flex justify="between" align="center" mb="6">
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
              style={{ fontSize: "var(--font-size-7)", fontWeight: "bold" }}
            />
          ) : (
            <Heading
              size="7"
              onClick={() => setIsEditingName(true)}
              style={{ cursor: "pointer" }}
            >
              {optimisticName}
            </Heading>
          )}
          <Text size="3" color="gray">
            {startedAgo}
          </Text>
        </Box>
        <Flex gap="2">
          <Button onClick={() => setShowCompletionModal(true)} size="3">
            Complete Workout
          </Button>
          <Button
            variant="soft"
            color="red"
            size="3"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel
          </Button>
        </Flex>
      </Flex>

      {/* Exercise Cards */}
      {workoutSession.exerciseGroups.map((group) => (
        <WorkoutExerciseCard key={group.exercise.id} exerciseGroup={group} />
      ))}

      {/* Add Exercise Button */}
      <Button
        onClick={() => setShowExerciseSelector(true)}
        size="3"
        style={{ width: "100%" }}
      >
        Add Exercise
      </Button>

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
    </Box>
  );
}
