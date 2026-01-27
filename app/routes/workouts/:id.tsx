import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftIcon, DotsVerticalIcon } from "@radix-ui/react-icons";
import {
  Button,
  DropdownMenu,
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
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
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
import "./active-workout.css";

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

        const historicalResult =
          await WorkoutSessionRepository.getLastCompletedSetsForExercise(
            exerciseId,
          );
        const defaultSetValues =
          historicalResult.isOk() && historicalResult.value.length > 0
            ? {
                reps: historicalResult.value[0].reps,
                weight: historicalResult.value[0].weight,
              }
            : undefined;

        const result = await WorkoutSessionRepository.addExercise(
          id,
          exerciseId,
          maxOrderIndex + 1,
          notes,
          defaultSetValues,
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

      case "replace-exercise": {
        const oldExerciseId = formData.get("oldExerciseId")?.toString();
        const newExerciseId = formData.get("newExerciseId")?.toString();

        if (!oldExerciseId || !newExerciseId) {
          return { error: "Both old and new exercise IDs are required" };
        }

        const replaceResult = await WorkoutSessionRepository.replaceExercise(
          id,
          oldExerciseId,
          newExerciseId,
        );

        if (replaceResult.isErr()) {
          return { error: "Failed to replace exercise" };
        }

        return { success: true };
      }

      case "reorder-exercises": {
        const exerciseIdsJson = formData.get("exerciseIds")?.toString();

        if (!exerciseIdsJson) {
          return { error: "Exercise IDs are required" };
        }

        const exerciseIds: string[] = JSON.parse(exerciseIdsJson);
        const reorderResult = await WorkoutSessionRepository.reorderExercises(
          id,
          exerciseIds,
        );

        if (reorderResult.isErr()) {
          return { error: "Failed to reorder exercises" };
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
  const [replaceExerciseId, setReplaceExerciseId] = useState<string>();
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const fetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groups = workoutSession.exerciseGroups;
    const oldIndex = groups.findIndex((g) => g.exercise.id === active.id);
    const newIndex = groups.findIndex((g) => g.exercise.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...groups];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorderFetcher.submit(
      {
        intent: "reorder-exercises",
        exerciseIds: JSON.stringify(reordered.map((g) => g.exercise.id)),
      },
      { method: "post" },
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="active-workout-page">
      {/* Header */}
      <header className="active-workout-header">
        <IconButton asChild variant="ghost" size="1">
          <Link to="/workouts">
            <ArrowLeftIcon />
          </Link>
        </IconButton>

        <div className="active-workout-header__info">
          {isEditingName ? (
            <TextField.Root
              ref={inputRef}
              defaultValue={optimisticName}
              size="2"
              onBlur={(e) => handleNameSubmit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNameSubmit(e.currentTarget.value);
                } else if (e.key === "Escape") {
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <Text
              size="3"
              weight="bold"
              className="active-workout-header__name"
              onClick={() => !isComplete && setIsEditingName(true)}
            >
              {optimisticName}
            </Text>
          )}
          <Text size="1" color="gray" className="active-workout-header__meta">
            {isComplete
              ? `${formatDate(workoutSession.workout.start)} · ${formattedDuration}`
              : startedAgo}
          </Text>
        </div>

        {!isComplete && (
          <Button size="1" onClick={() => setShowCompletionModal(true)}>
            Complete
          </Button>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="ghost" size="1">
              <DotsVerticalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {isComplete ? (
              <DropdownMenu.Item
                color="red"
                onSelect={() => setShowDeleteDialog(true)}
              >
                Delete Workout
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                color="red"
                onSelect={() => setShowCancelDialog(true)}
              >
                Cancel Workout
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </header>

      {/* Content */}
      <div className="active-workout-content">
        {!isComplete ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={workoutSession.exerciseGroups.map((g) => g.exercise.id)}
              strategy={verticalListSortingStrategy}
            >
              {workoutSession.exerciseGroups.map((group) => (
                <SortableExerciseCard
                  key={group.exercise.id}
                  group={group}
                  isComplete={false}
                  onCompleteSet={() => restTimer.start()}
                  onReplaceExercise={(exerciseId) => {
                    setReplaceExerciseId(exerciseId);
                    setShowExerciseSelector(true);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          workoutSession.exerciseGroups.map((group) => {
            const viewModel = createWorkoutExerciseCardViewModel(group, true);
            return (
              <WorkoutExerciseCard
                key={group.exercise.id}
                viewModel={viewModel}
              />
            );
          })
        )}

        {!isComplete && (
          <div className="active-workout-add-exercise">
            <Button
              onClick={() => {
                setReplaceExerciseId(undefined);
                setShowExerciseSelector(true);
              }}
              size="2"
              variant="soft"
            >
              Add Exercise
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExerciseSelector
        exercises={exercises}
        open={showExerciseSelector}
        onOpenChange={(open) => {
          setShowExerciseSelector(open);
          if (!open) setReplaceExerciseId(undefined);
        }}
        replaceExerciseId={replaceExerciseId}
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
    </div>
  );
}

function SortableExerciseCard({
  group,
  isComplete,
  onCompleteSet,
  onReplaceExercise,
}: {
  readonly group: WorkoutExerciseGroup;
  readonly isComplete: boolean;
  readonly onCompleteSet?: () => void;
  readonly onReplaceExercise?: (exerciseId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const viewModel = createWorkoutExerciseCardViewModel(group, isComplete);

  return (
    <div ref={setNodeRef} style={style}>
      <WorkoutExerciseCard
        viewModel={viewModel}
        onCompleteSet={onCompleteSet}
        onReplaceExercise={onReplaceExercise}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}
