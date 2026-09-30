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
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Kbd,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import { logger } from "~/logger.server";
import {
  exerciseTypes,
  type WorkoutExerciseGroup,
} from "~/modules/fitness/domain/workout";
import { duplicateWorkout } from "~/modules/fitness/infra/duplicate-workout.service.server";
import {
  addExercisesToWorkout,
  addExerciseToWorkout,
  addSetToWorkout,
  completeWorkout,
  destroyWorkout,
  getWorkoutSessionData,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  reorderExercisesInWorkout,
  replaceExerciseInWorkout,
  updateExerciseMmcInstructions,
  updateExerciseNotes,
  updateSetInWorkout,
  updateWorkoutName,
} from "~/modules/fitness/infra/workout-session.service.server";
import {
  createWorkoutExerciseCardViewModel,
  EditMMCModal,
  ExerciseHistoryModal,
  WorkoutExerciseCard,
} from "~/modules/fitness/presentation";
import { exerciseEditorUrl } from "~/modules/fitness/presentation/exercise-editor-navigation";
import { reorderExerciseGroups } from "~/modules/fitness/presentation/reorder-exercise-groups";
import { isEditableTarget } from "~/utils/dom";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/index";
import "./active-workout.css";

export async function loader({ params }: Route.LoaderArgs) {
  const id = parseWorkoutId(params.id);
  return getWorkoutSessionData(id);
}

export async function action({ request, params }: Route.ActionArgs) {
  const id = parseWorkoutId(params.id);
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

      case "add-exercises": {
        const exerciseIds = formData.getAll("exerciseIds").map(String);
        return addExercisesToWorkout({
          workoutId: id,
          exerciseIds,
        });
      }

      case "update-exercise-mmc": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          mmcInstructions: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return updateExerciseMmcInstructions({
          exerciseId: parsed.exerciseId,
          mmcInstructions: parsed.mmcInstructions,
        });
      }

      case "update-exercise-notes": {
        const schema = zfd.formData({
          exerciseId: formText(z.string().min(1)),
          notes: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return updateExerciseNotes({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          notes: parsed.notes ?? null,
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
        const schema = zfd.formData({
          oldExerciseId: formText(z.string().min(1)),
          newExerciseId: formText(z.string().min(1)),
        });
        const parsed = schema.parse(formData);
        return replaceExerciseInWorkout({
          workoutId: id,
          oldExerciseId: parsed.oldExerciseId,
          newExerciseId: parsed.newExerciseId,
        });
      }

      case "reorder-exercises": {
        const exerciseIdsJson = formData.get("exerciseIds")?.toString();

        if (!exerciseIdsJson) {
          return { error: "Exercise IDs are required" };
        }

        const exerciseIds: string[] = JSON.parse(exerciseIdsJson);
        return reorderExercisesInWorkout({
          workoutId: id,
          exerciseIds,
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
          rpe: formOptionalText(),
          reportedRir: formOptionalText(),
          isCompleted: formOptionalText(),
          isWarmup: formOptionalText(),
        });
        const parsed = schema.parse(formData);
        return updateSetInWorkout({
          workoutId: id,
          exerciseId: parsed.exerciseId,
          setNumberStr: parsed.setNumber,
          repsStr: parsed.reps ?? undefined,
          weightStr: parsed.weight ?? undefined,
          note: parsed.note ?? undefined,
          rpeStr: parsed.rpe ?? undefined,
          reportedRirStr: parsed.reportedRir ?? undefined,
          isCompletedStr: parsed.isCompleted ?? undefined,
          isWarmupStr: parsed.isWarmup ?? undefined,
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

      case "cancel-workout":
      case "delete-workout": {
        return destroyWorkout({ workoutId: id });
      }

      case "duplicate-workout": {
        return duplicateWorkout(id);
      }

      default:
        return { error: "Unknown intent" };
    }
  } catch (error) {
    logger.error({ err: error }, "Workout action error");
    return { error: "Internal server error" };
  }
}

function parseWorkoutId(id: string): string {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new Response("Workout not found", { status: 404 });
  return parsed.data;
}

export default function WorkoutSession({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workoutSession, exercises } = loaderData;
  const workoutId = workoutSession.workout.id;
  const [openReport, setOpenReport] = useState<{
    readonly workoutId: string;
    readonly key: string;
  }>();
  const openReportSetKey =
    openReport?.workoutId === workoutId ? openReport.key : undefined;
  const onReportPromptChange = useCallback(
    (key: string, open: boolean) => {
      setOpenReport((current) =>
        open
          ? { workoutId, key }
          : current?.workoutId === workoutId && current.key === key
            ? undefined
            : current,
      );
    },
    [workoutId],
  );
  const [showExerciseSelector, setShowExerciseSelector] = useState(
    searchParams.get("selectExercise") === "1",
  );
  const [replaceExerciseId, setReplaceExerciseId] = useState<
    string | undefined
  >(
    z
      .uuid()
      .optional()
      .catch(undefined)
      .parse(searchParams.get("replaceExerciseId") ?? undefined),
  );
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [historyExercise, setHistoryExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [mmcExercise, setMmcExercise] = useState<{
    id: string;
    name: string;
    mmcInstructions?: string;
  } | null>(null);

  const fetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const inputRef = useRef<HTMLInputElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const isComplete = !!workoutSession.workout.stop;

  const { startedAgo, formattedDuration } = useLiveDuration({
    startTime: workoutSession.workout.start,
    endTime: workoutSession.workout.stop ?? undefined,
  });

  const restTimer = useRestTimer();

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome) return;

    const updateChromeHeight = () => {
      setChromeHeight(chrome.getBoundingClientRect().height);
    };

    updateChromeHeight();

    const observer = new ResizeObserver(updateChromeHeight);
    observer.observe(chrome);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isEditableTarget(e.target)) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setReplaceExerciseId(undefined);
        setShowExerciseSelector(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.length,
    0,
  );
  const completedSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

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
    if (!over) return;

    const reordered = reorderExerciseGroups(
      workoutSession.exerciseGroups,
      String(active.id),
      String(over.id),
    );
    if (!reordered) return;

    reorderFetcher.submit(
      {
        intent: "reorder-exercises",
        exerciseIds: JSON.stringify(reordered.map((g) => g.exercise.id)),
      },
      { method: "post" },
    );
  };

  const pageStyle: React.CSSProperties & { "--session-chrome-height": string } =
    {
      "--session-chrome-height": `${chromeHeight}px`,
    };

  return (
    <div className="active-workout-page" style={pageStyle}>
      {/* Header — editorial style */}
      <div ref={chromeRef} className="active-workout-chrome">
        <header className="active-workout-header">
          <Flex justify="between" align="start" gap="2">
            <Flex align="start" gap="2" className="active-workout-header__left">
              <Tooltip content="Back to Workouts">
                <IconButton
                  asChild
                  variant="ghost"
                  size="1"
                  className="active-workout-header__back"
                  aria-label="Back to Workouts"
                >
                  <Link to="/workouts">
                    <ArrowLeftIcon />
                  </Link>
                </IconButton>
              </Tooltip>

              <div className="active-workout-header__title-group">
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
                  />
                ) : (
                  <Text
                    size="7"
                    weight="bold"
                    className={`active-workout-header__name${!isComplete ? " active-workout-header__name--live" : ""}`}
                    onClick={() => !isComplete && setIsEditingName(true)}
                  >
                    {optimisticName}
                  </Text>
                )}
                <div className="active-workout-header__subtitle">
                  {!isComplete && (
                    <span className="active-workout-header__live-badge">
                      Live
                    </span>
                  )}
                  <Text size="2" className="active-workout-header__started-ago">
                    {startedAgo}
                  </Text>
                </div>
              </div>
            </Flex>

            <Flex
              align="center"
              gap="2"
              className="active-workout-header__actions"
            >
              {!isComplete && (
                <Button size="1" onClick={() => setShowCompletionModal(true)}>
                  Complete
                </Button>
              )}

              <DropdownMenu.Root>
                <Tooltip content="Workout actions">
                  <DropdownMenu.Trigger>
                    <IconButton
                      variant="ghost"
                      size="1"
                      aria-label="Workout actions"
                    >
                      <DotsVerticalIcon />
                    </IconButton>
                  </DropdownMenu.Trigger>
                </Tooltip>
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
            </Flex>
          </Flex>
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
      </div>

      {/* Stats row */}
      {totalSets > 0 && (
        <div className="active-workout-stats">
          <div className="active-workout-stats__grid">
            <div>
              <span className="display-number display-number--lg">
                {formattedDuration}
              </span>
              <Text as="p" size="1" className="active-workout-stats__label">
                elapsed
              </Text>
            </div>
            <div>
              <span className="display-number display-number--lg">
                {completedSets}
                <span className="display-number--unit">/{totalSets}</span>
              </span>
              <Text as="p" size="1" className="active-workout-stats__label">
                sets
              </Text>
            </div>
            <div>
              <span className="display-number display-number--lg">
                {Math.round(progressPercent)}%
              </span>
              <Text as="p" size="1" className="active-workout-stats__label">
                done
              </Text>
            </div>
          </div>

          <div className="active-workout-progress">
            <div
              className="active-workout-progress__bar"
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Workout progress"
              aria-valuetext={`${completedSets} of ${totalSets} sets completed`}
            >
              <div
                className="active-workout-progress__fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exercise sections */}
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
                  openReportSetKey={openReportSetKey}
                  onReportPromptChange={onReportPromptChange}
                  onCompleteSet={restTimer.start}
                  onReplaceExercise={(exerciseId) => {
                    setReplaceExerciseId(exerciseId);
                    setShowExerciseSelector(true);
                  }}
                  onExerciseNameClick={(exerciseId) => {
                    const g = workoutSession.exerciseGroups.find(
                      (eg) => eg.exercise.id === exerciseId,
                    );
                    if (g)
                      setHistoryExercise({
                        id: g.exercise.id,
                        name: g.exercise.name,
                      });
                  }}
                  onMMCClick={(exerciseId) => {
                    const g = workoutSession.exerciseGroups.find(
                      (eg) => eg.exercise.id === exerciseId,
                    );
                    if (g)
                      setMmcExercise({
                        id: g.exercise.id,
                        name: g.exercise.name,
                        mmcInstructions: g.exercise.mmcInstructions,
                      });
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
                <WorkoutExerciseCard
                  viewModel={viewModel}
                  openReportSetKey={openReportSetKey}
                  onReportPromptChange={onReportPromptChange}
                  onExerciseNameClick={() =>
                    setHistoryExercise({
                      id: group.exercise.id,
                      name: group.exercise.name,
                    })
                  }
                />
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
              aria-keyshortcuts="n"
            >
              Add Exercise
              <Box ml="2" display={{ initial: "none", md: "inline-block" }}>
                <Kbd size="1">N</Kbd>
              </Box>
            </Button>
          </div>
        )}
      </div>

      <ExerciseSelector
        correctionHref={(exerciseId, context) => {
          const params = new URLSearchParams(searchParams);
          params.set("selectExercise", "1");
          params.set("exerciseSearch", context.query);
          params.set("exerciseType", context.type);
          params.delete("selectedExerciseIds");
          for (const id of context.selectedIds)
            params.append("selectedExerciseIds", id);
          if (context.replacementSelectionId)
            params.set("selectedReplacementId", context.replacementSelectionId);
          else params.delete("selectedReplacementId");
          if (replaceExerciseId)
            params.set("replaceExerciseId", replaceExerciseId);
          else params.delete("replaceExerciseId");
          return exerciseEditorUrl(
            exerciseId,
            `/workouts/${workoutId}?${params}`,
          );
        }}
        onCorrectionNavigate={async (href) => {
          const returnTo = new URL(
            href,
            window.location.origin,
          ).searchParams.get("returnTo");
          if (!returnTo) return;
          await navigate(returnTo, { replace: true, preventScrollReset: true });
          await navigate(href);
        }}
        initialSelectedIds={z
          .array(z.uuid())
          .catch([])
          .parse(searchParams.getAll("selectedExerciseIds"))}
        initialReplacementSelectionId={z
          .uuid()
          .optional()
          .catch(undefined)
          .parse(searchParams.get("selectedReplacementId") ?? undefined)}
        initialSearchQuery={z
          .string()
          .max(200)
          .catch("")
          .parse(searchParams.get("exerciseSearch") ?? "")}
        initialType={z
          .enum(["all", ...exerciseTypes])
          .catch("all")
          .parse(searchParams.get("exerciseType") ?? "all")}
        exercises={exercises}
        open={showExerciseSelector}
        onOpenChange={(open) => {
          setShowExerciseSelector(open);
          if (!open) {
            setReplaceExerciseId(undefined);
            if (searchParams.get("selectExercise") === "1") {
              const params = new URLSearchParams(searchParams);
              for (const key of [
                "selectExercise",
                "exerciseSearch",
                "exerciseType",
                "replaceExerciseId",
                "selectedExerciseIds",
                "selectedReplacementId",
              ])
                params.delete(key);
              setSearchParams(params, {
                replace: true,
                preventScrollReset: true,
              });
            }
          }
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

      {historyExercise && (
        <ExerciseHistoryModal
          exerciseId={historyExercise.id}
          exerciseName={historyExercise.name}
          open={!!historyExercise}
          onOpenChange={(open) => {
            if (!open) setHistoryExercise(null);
          }}
        />
      )}

      {mmcExercise && (
        <EditMMCModal
          exerciseId={mmcExercise.id}
          exerciseName={mmcExercise.name}
          mmcInstructions={mmcExercise.mmcInstructions}
          open={!!mmcExercise}
          onOpenChange={(open) => {
            if (!open) setMmcExercise(null);
          }}
        />
      )}
    </div>
  );
}

function SortableExerciseCard({
  group,
  onCompleteSet,
  onReplaceExercise,
  onExerciseNameClick,
  onMMCClick,
  openReportSetKey,
  onReportPromptChange,
}: {
  readonly group: WorkoutExerciseGroup;
  readonly onCompleteSet?: () => void;
  readonly onReplaceExercise?: (exerciseId: string) => void;
  readonly onExerciseNameClick?: (exerciseId: string) => void;
  readonly onMMCClick?: (exerciseId: string) => void;
  readonly openReportSetKey?: string;
  readonly onReportPromptChange?: (key: string, open: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: group.exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const viewModel = createWorkoutExerciseCardViewModel(group, false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="active-workout-exercise"
      data-exercise-id={group.exercise.id}
    >
      <WorkoutExerciseCard
        viewModel={viewModel}
        openReportSetKey={openReportSetKey}
        onReportPromptChange={onReportPromptChange}
        onCompleteSet={onCompleteSet}
        onReplaceExercise={onReplaceExercise}
        onExerciseNameClick={onExerciseNameClick}
        onMMCClick={onMMCClick}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
        dragHandleRef={setActivatorNodeRef}
      />
    </div>
  );
}
