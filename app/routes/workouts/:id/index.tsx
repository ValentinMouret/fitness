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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link, useFetcher, useFetchers, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { CancelConfirmationDialog } from "~/components/workout/CancelConfirmationDialog";
import { CompletionModal } from "~/components/workout/CompletionModal";
import { DeleteConfirmationDialog } from "~/components/workout/DeleteConfirmationDialog";
import { ExerciseSelector } from "~/components/workout/ExerciseSelector";
import { RestTimer, useRestTimer } from "~/components/workout/RestTimer";
import { useLiveDuration } from "~/components/workout/useLiveDuration";
import { logger } from "~/logger.server";
import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";
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
import { reorderExerciseGroups } from "~/modules/fitness/presentation/reorder-exercise-groups";
import {
  createWorkoutProgressViewModel,
  type WorkoutExerciseProgressViewModel,
} from "~/modules/fitness/presentation/view-models/workout-progress.view-model";
import { isEditableTarget } from "~/utils/dom";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/index";
import "./active-workout.css";

export async function loader({ params, request }: Route.LoaderArgs) {
  const id = parseWorkoutId(params.id);
  const focusExerciseId = z
    .uuid()
    .optional()
    .catch(undefined)
    .parse(new URL(request.url).searchParams.get("exercise") ?? undefined);
  return { ...(await getWorkoutSessionData(id)), focusExerciseId };
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
  const { workoutSession, exercises } = loaderData;
  const workoutId = workoutSession.workout.id;
  const [searchParams] = useSearchParams();
  const focusExerciseId = workoutSession.exerciseGroups.find(
    (group) => group.exercise.id === loaderData.focusExerciseId,
  )?.exercise.id;
  const focusedIndex = workoutSession.exerciseGroups.findIndex(
    (group) => group.exercise.id === focusExerciseId,
  );
  const progress = createWorkoutProgressViewModel(
    workoutSession.exerciseGroups,
  );
  const pendingSave = useFetchers().some((fetcher) => fetcher.state !== "idle");
  const scrollPositions = useRef(new Map<string, number>());
  const viewKey = `${workoutId}:${focusExerciseId ?? "overview"}`;
  const rememberScroll = () => {
    const content = document.querySelector<HTMLElement>(".main-content");
    if (content) scrollPositions.current.set(viewKey, content.scrollTop);
  };
  useLayoutEffect(() => {
    const content = document.querySelector<HTMLElement>(".main-content");
    if (!content) return;
    content.scrollTop = scrollPositions.current.get(viewKey) ?? 0;
    const saveScroll = () => {
      scrollPositions.current.set(viewKey, content.scrollTop);
    };
    content.addEventListener("scroll", saveScroll);
    return () => content.removeEventListener("scroll", saveScroll);
  }, [viewKey]);
  const exerciseHref = (exerciseId?: string) => {
    const params = new URLSearchParams(searchParams);
    if (exerciseId) params.set("exercise", exerciseId);
    else params.delete("exercise");
    const query = params.toString();
    return `/workouts/${workoutId}${query ? `?${query}` : ""}`;
  };
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
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [replaceExerciseId, setReplaceExerciseId] = useState<string>();
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

  const { startedAgo } = useLiveDuration({
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

  const { totalSets, completedSets, percent: progressPercent } = progress;
  const handleCompletedSet = useCallback(() => {
    restTimer.start();
    if (!isComplete && progress.allSetsCompleted) setShowCompletionModal(true);
  }, [restTimer.start, isComplete, progress.allSetsCompleted]);

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
                    size="3"
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
              {!isComplete && focusExerciseId && (
                <>
                  <Text size="1">
                    {focusedIndex + 1} / {workoutSession.exerciseGroups.length}
                  </Text>
                  <Button asChild variant="soft" size="1">
                    <Link
                      to={exerciseHref()}
                      onClick={rememberScroll}
                      preventScrollReset
                    >
                      Overview
                    </Link>
                  </Button>
                </>
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
            onStart={restTimer.start}
            onDismiss={restTimer.dismiss}
            onSetDuration={restTimer.setDuration}
          />
        )}
      </div>

      {!focusExerciseId && (
        <div className="active-workout-progress-summary">
          <h1>{optimisticName}</h1>
          <Text as="p" size="2" color="gray">
            {completedSets} of {totalSets} sets saved
          </Text>
          {totalSets > 0 && (
            <div
              className="active-workout-progress__bar"
              role="progressbar"
              aria-label="Workout progress"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${completedSets} of ${totalSets} sets completed`}
            >
              <div
                className="active-workout-progress__fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
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
                  summary={progress.exercises.find(
                    (exercise) => exercise.id === group.exercise.id,
                  )}
                  focusExerciseId={focusExerciseId}
                  href={exerciseHref(group.exercise.id)}
                  onNavigate={rememberScroll}
                  openReportSetKey={openReportSetKey}
                  onReportPromptChange={onReportPromptChange}
                  onCompleteSet={handleCompletedSet}
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

        {!isComplete && focusExerciseId && (
          <nav
            className="active-workout-exercise-navigation"
            aria-label="Exercise navigation"
          >
            {focusedIndex > 0 ? (
              <Link
                to={exerciseHref(
                  workoutSession.exerciseGroups[focusedIndex - 1].exercise.id,
                )}
                onClick={rememberScroll}
                preventScrollReset
              >
                ‹ Previous
              </Link>
            ) : (
              <span />
            )}
            {focusedIndex < workoutSession.exerciseGroups.length - 1 ? (
              <Link
                to={exerciseHref(
                  workoutSession.exerciseGroups[focusedIndex + 1].exercise.id,
                )}
                onClick={rememberScroll}
                preventScrollReset
              >
                Next ›
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
        {!isComplete && !focusExerciseId && totalSets > 0 && (
          <Button
            type="button"
            className="active-workout-finish"
            disabled={pendingSave}
            onClick={() => setShowCompletionModal(true)}
          >
            Finish workout
          </Button>
        )}
        {!isComplete && !focusExerciseId && (
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
        isSaving={pendingSave}
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
  summary,
  focusExerciseId,
  href,
  onNavigate,
  onCompleteSet,
  onReplaceExercise,
  onExerciseNameClick,
  onMMCClick,
  openReportSetKey,
  onReportPromptChange,
}: {
  readonly group: WorkoutExerciseGroup;
  readonly summary?: WorkoutExerciseProgressViewModel;
  readonly focusExerciseId?: string;
  readonly href: string;
  readonly onNavigate: () => void;
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
      hidden={
        focusExerciseId !== undefined && focusExerciseId !== group.exercise.id
      }
    >
      <div
        hidden={focusExerciseId !== undefined}
        className={`active-workout-overview-exercise${summary?.isCompleted ? " active-workout-overview-exercise--completed" : ""}`}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="exercise-card__drag-handle"
          aria-label={`Reorder ${group.exercise.name}`}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <Link
          to={href}
          onClick={onNavigate}
          preventScrollReset
          aria-label={`Open ${group.exercise.name}`}
        >
          <span className="active-workout-overview-exercise__copy">
            <span className="active-workout-overview-exercise__name">
              {group.exercise.name}
            </span>
            <span className="active-workout-overview-exercise__meta">
              {summary?.isCompleted
                ? "Completed"
                : `${summary?.totalSets ?? 0} sets`}{" "}
              · {group.exercise.type}
            </span>
          </span>
          <span>
            {summary?.completedSets ?? 0}/{summary?.totalSets ?? 0} ›
          </span>
        </Link>
      </div>
      <div hidden={focusExerciseId === undefined}>
        <WorkoutExerciseCard
          focused
          progressLabel={`${summary?.completedSets ?? 0} of ${summary?.totalSets ?? 0} sets saved`}
          viewModel={viewModel}
          openReportSetKey={openReportSetKey}
          onReportPromptChange={onReportPromptChange}
          onCompleteSet={onCompleteSet}
          onReplaceExercise={onReplaceExercise}
          onExerciseNameClick={onExerciseNameClick}
          onMMCClick={onMMCClick}
        />
      </div>
    </div>
  );
}
