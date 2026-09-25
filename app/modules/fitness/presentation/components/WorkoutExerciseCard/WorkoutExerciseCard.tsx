import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  CheckIcon,
  DotsVerticalIcon,
  DragHandleDots2Icon,
  LoopIcon,
  Pencil1Icon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import {
  Button,
  Callout,
  DropdownMenu,
  IconButton,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { Brain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { NumberInput } from "~/components/NumberInput";
import type {
  WorkoutExerciseCardViewModel,
  WorkoutSetViewModel,
} from "../../view-models/workout-exercise-card.view-model";
import "./WorkoutExerciseCard.css";

interface WorkoutExerciseCardProps {
  readonly viewModel: WorkoutExerciseCardViewModel;
  readonly onAddSet?: (
    exerciseId: string,
    lastSet?: WorkoutSetViewModel,
  ) => void;
  readonly onRemoveExercise?: (exerciseId: string) => void;
  readonly onReplaceExercise?: (exerciseId: string) => void;
  readonly onCompleteSet?: () => void;
  readonly onExerciseNameClick?: (exerciseId: string) => void;
  readonly onMMCClick?: (exerciseId: string) => void;
  readonly openReportSetKey?: string;
  readonly onReportPromptChange?: (key: string, open: boolean) => void;
  readonly dragHandleListeners?: SyntheticListenerMap;
  readonly dragHandleAttributes?: DraggableAttributes;
  readonly dragHandleRef?: (element: HTMLElement | null) => void;
}

export function WorkoutExerciseCard({
  viewModel,
  onAddSet,
  onRemoveExercise,
  onReplaceExercise,
  onCompleteSet,
  onExerciseNameClick,
  onMMCClick,
  openReportSetKey,
  onReportPromptChange,
  dragHandleListeners,
  dragHandleAttributes,
  dragHandleRef,
}: WorkoutExerciseCardProps) {
  const fetcher = useFetcher();

  const isAddingSet =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "add-set" &&
    fetcher.formData?.get("exerciseId") === viewModel.exerciseId;

  const isBusy = fetcher.state !== "idle";

  const handleAddSet = () => {
    if (onAddSet) {
      onAddSet(viewModel.exerciseId, viewModel.lastSet);
    } else {
      const formData: Record<string, string> = {
        intent: "add-set",
        exerciseId: viewModel.exerciseId,
      };

      if (viewModel.lastSet) {
        if (viewModel.lastSet.reps) {
          formData.reps = viewModel.lastSet.reps.toString();
        }
        if (viewModel.lastSet.weight) {
          formData.weight = viewModel.lastSet.weight.toString();
        }
      }

      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleRemoveExercise = () => {
    if (onRemoveExercise) {
      onRemoveExercise(viewModel.exerciseId);
    } else {
      fetcher.submit(
        { intent: "remove-exercise", exerciseId: viewModel.exerciseId },
        { method: "post" },
      );
    }
  };

  return (
    <div className="exercise-card">
      <div className="exercise-card__header">
        {dragHandleListeners && (
          <button
            type="button"
            ref={dragHandleRef}
            className="exercise-card__drag-handle"
            aria-label="Drag to reorder"
            {...dragHandleListeners}
            {...dragHandleAttributes}
          >
            <DragHandleDots2Icon />
          </button>
        )}
        <button
          type="button"
          className="exercise-card__name exercise-card__name--clickable"
          onClick={() => onExerciseNameClick?.(viewModel.exerciseId)}
        >
          <Text size="3" weight="medium">
            {viewModel.exerciseName}
          </Text>
        </button>

        {viewModel.canRemoveExercise && (
          <DropdownMenu.Root>
            <Tooltip content="Exercise actions">
              <DropdownMenu.Trigger>
                <IconButton
                  variant="ghost"
                  size="1"
                  aria-label="Exercise actions"
                >
                  <DotsVerticalIcon />
                </IconButton>
              </DropdownMenu.Trigger>
            </Tooltip>
            <DropdownMenu.Content>
              {onReplaceExercise && (
                <DropdownMenu.Item
                  onSelect={() => onReplaceExercise(viewModel.exerciseId)}
                >
                  <LoopIcon /> Replace Exercise
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item color="red" onSelect={handleRemoveExercise}>
                <TrashIcon /> Delete Exercise
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>

      <Text size="1" color="gray" className="exercise-card__type">
        {viewModel.exerciseType}
      </Text>

      {viewModel.mmcInstructions && (
        <Callout.Root
          size="1"
          color="blue"
          mt="2"
          onClick={
            onMMCClick ? () => onMMCClick(viewModel.exerciseId) : undefined
          }
          style={onMMCClick ? { cursor: "pointer" } : undefined}
        >
          <Callout.Icon>
            <Brain size={16} />
          </Callout.Icon>
          <Callout.Text>{viewModel.mmcInstructions}</Callout.Text>
        </Callout.Root>
      )}
      {!viewModel.mmcInstructions && onMMCClick && (
        <button
          type="button"
          className="exercise-card__add-mmc"
          onClick={() => onMMCClick(viewModel.exerciseId)}
        >
          + Add mind-muscle cue
        </button>
      )}

      <div className="set-table">
        <div className="set-table-header">
          <span className="set-table-header__label set-table-header__label--center">
            #
          </span>
          <span className="set-table-header__label set-table-header__label--right">
            Weight
          </span>
          <span className="set-table-header__label set-table-header__label--right">
            Reps
          </span>
          <span className="set-table-header__label set-table-header__label--right">
            RIR
          </span>
          <span className="set-table-header__label set-table-header__label--center" />
        </div>

        {viewModel.sets.map((set) => (
          <SetRow
            key={`${viewModel.exerciseId}-${set.set}`}
            set={set}
            exerciseId={viewModel.exerciseId}
            canEdit={viewModel.canAddSets}
            onCompleteSet={onCompleteSet}
            openReportSetKey={openReportSetKey}
            onReportPromptChange={onReportPromptChange}
          />
        ))}
      </div>

      {viewModel.canAddSets && (
        <Button
          onClick={handleAddSet}
          size="1"
          variant="ghost"
          mt="3"
          loading={isAddingSet}
          disabled={isBusy && !isAddingSet}
        >
          <PlusIcon /> Add Set
        </Button>
      )}
    </div>
  );
}

interface SetRowProps {
  readonly set: WorkoutSetViewModel;
  readonly exerciseId: string;
  readonly canEdit: boolean;
  readonly onCompleteSet?: () => void;
  readonly openReportSetKey?: string;
  readonly onReportPromptChange?: (key: string, open: boolean) => void;
}

function SetRow({
  set,
  exerciseId,
  canEdit,
  onCompleteSet,
  openReportSetKey,
  onReportPromptChange,
}: SetRowProps) {
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? "");
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? "");
  const reportSetKey = `${exerciseId}:${set.set}`;
  const showReportPrompt = openReportSetKey === reportSetKey;
  const [editingCompleted, setEditingCompleted] = useState(false);
  const [editingSubmitted, setEditingSubmitted] = useState(false);
  const [completionSubmitted, setCompletionSubmitted] = useState(false);
  const completionNotified = useRef(false);
  const updateFetcher = useFetcher();
  const actionFetcher = useFetcher();
  const reportFetcher = useFetcher();
  const editFetcher = useFetcher();

  const isCompleting =
    actionFetcher.state !== "idle" &&
    actionFetcher.formData?.get("intent") === "update-set" &&
    actionFetcher.formData?.get("isCompleted") === "true";

  const isRemoving =
    actionFetcher.state !== "idle" &&
    actionFetcher.formData?.get("intent") === "remove-set" &&
    actionFetcher.formData?.get("setNumber") === set.set.toString();

  const isBusy = actionFetcher.state !== "idle";

  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
  }, [set.reps, set.weight]);

  useEffect(() => {
    if (isCompleting) {
      completionNotified.current = false;
      setCompletionSubmitted(true);
    }
  }, [isCompleting]);

  useEffect(() => {
    if (!completionSubmitted || actionFetcher.state !== "idle") return;
    if (actionFetcher.data?.error) {
      setCompletionSubmitted(false);
    } else if (actionFetcher.data?.success && set.isCompleted) {
      if (!completionNotified.current) {
        completionNotified.current = true;
        onCompleteSet?.();
      }
      if (!set.isWarmup) onReportPromptChange?.(reportSetKey, true);
      setCompletionSubmitted(false);
    }
  }, [
    actionFetcher.data,
    actionFetcher.state,
    completionSubmitted,
    set.isCompleted,
    set.isWarmup,
    onCompleteSet,
    onReportPromptChange,
    reportSetKey,
  ]);

  useEffect(() => {
    if (reportFetcher.state === "idle" && reportFetcher.data?.success) {
      onReportPromptChange?.(reportSetKey, false);
    }
  }, [
    reportFetcher.state,
    reportFetcher.data,
    onReportPromptChange,
    reportSetKey,
  ]);

  useEffect(() => {
    if (!editingSubmitted || editFetcher.state !== "idle") return;
    if (editFetcher.data?.success) setEditingCompleted(false);
    setEditingSubmitted(false);
  }, [editFetcher.data, editFetcher.state, editingSubmitted]);

  const rowClassName = [
    "set-row",
    set.isWarmup
      ? "set-row--warmup"
      : set.isCompleted
        ? "set-row--completed"
        : canEdit
          ? "set-row--pending"
          : "",
  ].join(" ");

  const handleToggleWarmup = () => {
    updateFetcher.submit(
      {
        intent: "update-set",
        exerciseId,
        setNumber: set.set.toString(),
        isWarmup: (!set.isWarmup).toString(),
      },
      { method: "post" },
    );
  };

  return (
    <div className={rowClassName}>
      {canEdit && !set.isCompleted ? (
        <button
          type="button"
          className={`set-row__number set-row__number--toggle ${set.isWarmup ? "set-row__number--warmup" : ""}`}
          onClick={handleToggleWarmup}
          aria-pressed={set.isWarmup}
          aria-label={`Toggle warmup for set ${set.set}`}
        >
          {set.isWarmup ? "W" : set.set}
        </button>
      ) : (
        <span
          className={`set-row__number ${set.isWarmup ? "set-row__number--warmup" : ""}`}
        >
          {set.isWarmup ? "W" : set.set}
        </span>
      )}

      {!canEdit || set.isCompleted ? (
        <>
          <Text size="2" className="set-row__value">
            {set.weight ? `${set.weight}` : "—"}
          </Text>
          <Text size="2" className="set-row__value">
            {set.reps ?? "—"}
          </Text>
          <div className="set-row__report-value">
            {canEdit && !set.isWarmup ? (
              <button
                type="button"
                onClick={() => onReportPromptChange?.(reportSetKey, true)}
                aria-label={`${set.reportedRir ? "Edit" : "Add"} set ${set.set} reported effort`}
              >
                {set.reportedRir === "unsure"
                  ? "Unsure"
                  : set.reportedRir
                    ? `~${set.reportedRir} left`
                    : "Add"}
              </button>
            ) : (
              <span>
                {set.reportedRir === "unsure"
                  ? "Unsure"
                  : set.reportedRir
                    ? `~${set.reportedRir} left`
                    : "—"}
              </span>
            )}
            {set.rpe !== undefined && <small>RPE {set.rpe} (legacy)</small>}
          </div>
        </>
      ) : (
        <>
          <updateFetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <NumberInput
              name="weight"
              value={localWeight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLocalWeight(e.target.value);
              }}
              placeholder="kg"
              size="2"
              variant="surface"
              className="set-row__input"
              aria-label={`Set ${set.set} weight`}
            />
          </updateFetcher.Form>
          <updateFetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <NumberInput
              name="reps"
              allowDecimals={false}
              value={localReps}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setLocalReps(e.target.value);
              }}
              placeholder="reps"
              size="2"
              variant="surface"
              className="set-row__input"
              aria-label={`Set ${set.set} reps`}
            />
          </updateFetcher.Form>
          <div className="set-row__report-value">
            <span>—</span>
            {set.rpe !== undefined && <small>RPE {set.rpe} (legacy)</small>}
          </div>
        </>
      )}

      <div className="set-row__actions">
        {canEdit && set.isCompleted && (
          <Tooltip content={`Edit set ${set.set}`}>
            <IconButton
              type="button"
              size="2"
              variant="ghost"
              aria-label={`Edit set ${set.set}`}
              onClick={() => setEditingCompleted(true)}
            >
              <Pencil1Icon />
            </IconButton>
          </Tooltip>
        )}
        {canEdit && !set.isCompleted && (
          <actionFetcher.Form method="post">
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <input type="hidden" name="isCompleted" value="true" />
            <Tooltip content={`Complete set ${set.set}`}>
              <IconButton
                type="submit"
                size="2"
                variant="soft"
                color="green"
                loading={isCompleting}
                disabled={isBusy && !isCompleting}
                aria-label={`Complete set ${set.set}`}
              >
                <CheckIcon />
              </IconButton>
            </Tooltip>
          </actionFetcher.Form>
        )}

        {canEdit && (
          <actionFetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <Tooltip content={`Remove set ${set.set}`}>
              <IconButton
                type="submit"
                size="1"
                variant="ghost"
                color="red"
                loading={isRemoving}
                disabled={isBusy && !isRemoving}
                aria-label={`Remove set ${set.set}`}
              >
                <TrashIcon />
              </IconButton>
            </Tooltip>
          </actionFetcher.Form>
        )}
      </div>

      {canEdit && set.isCompleted && editingCompleted && (
        <editFetcher.Form
          method="post"
          className="set-row__edit-form"
          onSubmit={() => setEditingSubmitted(true)}
        >
          <input type="hidden" name="intent" value="update-set" />
          <input type="hidden" name="exerciseId" value={exerciseId} />
          <input type="hidden" name="setNumber" value={set.set} />
          <NumberInput
            name="weight"
            defaultValue={set.weight?.toString() ?? ""}
            placeholder="kg"
            aria-label={`Set ${set.set} weight`}
          />
          <NumberInput
            name="reps"
            allowDecimals={false}
            defaultValue={set.reps?.toString() ?? ""}
            placeholder="reps"
            aria-label={`Set ${set.set} reps`}
          />
          {set.rpe !== undefined && (
            <NumberInput
              name="rpe"
              defaultValue={set.rpe.toString()}
              placeholder="Legacy RPE"
              aria-label={`Set ${set.set} legacy RPE`}
            />
          )}
          {!set.isWarmup && (
            <select
              name="reportedRir"
              defaultValue={set.reportedRir ?? "clear"}
              aria-label={`Set ${set.set} reported effort`}
            >
              <option value="clear">No report</option>
              <option value="0">0 left</option>
              <option value="1">1 left</option>
              <option value="2">2 left</option>
              <option value="3">3 left</option>
              <option value="4+">4+ left</option>
              <option value="unsure">Unsure</option>
            </select>
          )}
          <Button type="submit" size="2" loading={editFetcher.state !== "idle"}>
            Save
          </Button>
          <Button
            type="button"
            size="2"
            variant="soft"
            onClick={() => setEditingCompleted(false)}
          >
            Cancel
          </Button>
          {editFetcher.data?.error && (
            <Text color="red" size="1">
              {editFetcher.data.error}
            </Text>
          )}
        </editFetcher.Form>
      )}

      {canEdit && actionFetcher.data?.error && (
        <Text color="red" size="1" className="set-row__action-error">
          {actionFetcher.data.error}
        </Text>
      )}

      {canEdit && set.isCompleted && !set.isWarmup && showReportPrompt && (
        <div className="set-row__report-prompt">
          <span>How many more good reps could you have done?</span>
          <div className="set-row__report-options">
            {(["0", "1", "2", "3", "4+", "unsure"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={reportFetcher.state !== "idle"}
                aria-label={`Report ${value} good reps left for set ${set.set}`}
                onClick={() =>
                  reportFetcher.submit(
                    {
                      intent: "update-set",
                      exerciseId,
                      setNumber: set.set.toString(),
                      reportedRir: value,
                    },
                    { method: "post" },
                  )
                }
              >
                {value === "unsure" ? "Unsure" : value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onReportPromptChange?.(reportSetKey, false)}
            >
              Skip
            </button>
          </div>
          {reportFetcher.data?.error && (
            <Text color="red" size="1">
              {reportFetcher.data.error}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
