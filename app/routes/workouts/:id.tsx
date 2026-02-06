import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
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
import { z } from "zod";
import { zfd } from "zod-form-data";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import { duplicateWorkout } from "~/modules/fitness/application/duplicate-workout.service.server";
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
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
import { Workout } from "~/modules/fitness/domain/workout";
import { WorkoutSessionRepository } from "~/modules/fitness/infra/workout.repository.server";
import {
  createWorkoutExerciseCardViewModel,
  WorkoutExerciseCard,
} from "~/modules/fitness/presentation";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/:id";
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

function findNextIncompleteExerciseId(
  groups: ReadonlyArray<WorkoutExerciseGroup>,
  afterIndex?: number,
): string | undefined {
  const start = afterIndex !== undefined ? afterIndex + 1 : 0;
  for (let i = start; i < groups.length; i++) {
    if (groups[i].sets.some((s) => !s.isCompleted)) {
      return groups[i].exercise.id;
    }
  }
  return undefined;
}

function scrollToExercise(exerciseId: string): void {
  const el = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const exerciseGroupsRef = useRef(loaderData?.workoutSession.exerciseGroups);
  exerciseGroupsRef.current = loaderData?.workoutSession.exerciseGroups;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const groups = exerciseGroupsRef.current;
      if (!groups) return;
      const id = findNextIncompleteExerciseId(groups);
      if (id) {
        setTimeout(() => scrollToExercise(id), 100);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (!loaderData) {
    return <div>Loading...</div>;
  }

  const { workoutSession, exercises } = loaderData;
  const isComplete = Workout.isComplete.call(workoutSession.workout);

  const totalSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.length,
    0,
  );
  const completedSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const totalVolume = workoutSession.exerciseGroups.reduce(
    (sum, group) =>
      sum +
      group.sets
        .filter((set) => set.isCompleted && set.reps && set.weight)
        .reduce((s, set) => s + (set.reps ?? 0) * (set.weight ?? 0), 0),
    0,
  );

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

      {!isComplete && (
        <RestTimer
          isActive={restTimer.isActive}
          secondsRemaining={restTimer.secondsRemaining}
          totalSeconds={restTimer.totalSeconds}
          onDismiss={restTimer.dismiss}
          onSetDuration={restTimer.setDuration}
        />
      )}

      {!isComplete && totalSets > 0 && (
        <div className="active-workout-progress">
          <div className="active-workout-progress__bar">
            <div
              className="active-workout-progress__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <Text size="1" color="gray" className="active-workout-progress__text">
            {completedSets}/{totalSets}
          </Text>
        </div>
      )}

      {isComplete && (
        <div className="active-workout-summary">
          <div className="active-workout-summary__grid">
            <div className="active-workout-summary__stat">
              <span className="active-workout-summary__stat-value">
                {formattedDuration}
              </span>
              <span className="active-workout-summary__stat-label">
                Duration
              </span>
            </div>
            <div className="active-workout-summary__stat">
              <span className="active-workout-summary__stat-value">
                {workoutSession.exerciseGroups.length}
              </span>
              <span className="active-workout-summary__stat-label">
                Exercises
              </span>
            </div>
            <div className="active-workout-summary__stat">
              <span className="active-workout-summary__stat-value">
                {completedSets}/{totalSets}
              </span>
              <span className="active-workout-summary__stat-label">Sets</span>
            </div>
            <div className="active-workout-summary__stat">
              <span className="active-workout-summary__stat-value">
                {totalVolume >= 1000
                  ? `${(totalVolume / 1000).toFixed(1)}t`
                  : totalVolume > 0
                    ? `${totalVolume}kg`
                    : "—"}
              </span>
              <span className="active-workout-summary__stat-label">Volume</span>
            </div>
          </div>
        </div>
      )}

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
              {workoutSession.exerciseGroups.map((group, index) => (
                <SortableExerciseCard
                  key={group.exercise.id}
                  group={group}
                  isComplete={false}
                  onCompleteSet={() => {
                    restTimer.start();
                    const incompleteSets = group.sets.filter(
                      (s) => !s.isCompleted,
                    ).length;
                    if (incompleteSets <= 1) {
                      const nextId = findNextIncompleteExerciseId(
                        workoutSession.exerciseGroups,
                        index,
                      );
                      if (nextId) {
                        setTimeout(() => scrollToExercise(nextId), 300);
                      }
                    }
                  }}
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
              <div key={group.exercise.id} className="active-workout-exercise">
                <WorkoutExerciseCard viewModel={viewModel} />
              </div>
            );
          })
        )}

        {!isComplete && workoutSession.exerciseGroups.length === 0 && (
          <div className="active-workout-empty">
            <div className="active-workout-empty__icon">🏋️</div>
            <Text size="3" weight="medium">
              No exercises yet
            </Text>
            <Text size="2" color="gray">
              Add your first exercise to get started
            </Text>
          </div>
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
    <div
      ref={setNodeRef}
      style={style}
      className="active-workout-exercise"
      data-exercise-id={group.exercise.id}
    >
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
