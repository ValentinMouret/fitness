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
import { Link, useFetcher } from "react-router";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
import { Workout } from "~/modules/fitness/domain/workout";
import { WorkoutSessionRepository } from "~/modules/fitness/infra/workout.repository.server";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { formOptionalText, formText } from "~/utils/form-data";
import {
  createWorkoutExerciseCardViewModel,
  WorkoutExerciseCard,
} from "~/modules/fitness/presentation";
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
import "./active-workout.css";

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
              <>
                <DropdownMenu.Item
                  onSelect={() =>
                    fetcher.submit(
                      { intent: "duplicate-workout" },
                      { method: "post" },
                    )
                  }
                >
                  Repeat Workout
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  color="red"
                  onSelect={() => setShowDeleteDialog(true)}
                >
                  Delete Workout
                </DropdownMenu.Item>
              </>
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
