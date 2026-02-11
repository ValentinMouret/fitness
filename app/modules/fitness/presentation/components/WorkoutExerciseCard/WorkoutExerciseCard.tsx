import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  DotsVerticalIcon,
  DragHandleDots2Icon,
  LoopIcon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import {
  Button,
  Callout,
  DropdownMenu,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { Brain } from "lucide-react";
import { useEffect, useState } from "react";
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
  readonly onUpdateSet?: (
    exerciseId: string,
    setNumber: number,
    field: string,
    value: string,
  ) => void;
  readonly onCompleteSet?: (exerciseId: string, setNumber: number) => void;
  readonly onRemoveSet?: (exerciseId: string, setNumber: number) => void;
  readonly onExerciseNameClick?: (exerciseId: string) => void;
  readonly dragHandleListeners?: SyntheticListenerMap;
  readonly dragHandleAttributes?: DraggableAttributes;
}

export function WorkoutExerciseCard({
  viewModel,
  onAddSet,
  onRemoveExercise,
  onReplaceExercise,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
  onExerciseNameClick,
  dragHandleListeners,
  dragHandleAttributes,
}: WorkoutExerciseCardProps) {
  const fetcher = useFetcher();

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
            className="exercise-card__drag-handle"
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
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1">
                <DotsVerticalIcon />
              </IconButton>
            </DropdownMenu.Trigger>
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
        <Callout.Root size="1" color="blue" mt="2">
          <Callout.Icon>
            <Brain size={16} />
          </Callout.Icon>
          <Callout.Text>{viewModel.mmcInstructions}</Callout.Text>
        </Callout.Root>
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
            RPE
          </span>
          <span className="set-table-header__label set-table-header__label--center" />
        </div>

        {viewModel.sets.map((set) => (
          <SetRow
            key={`${viewModel.exerciseId}-${set.set}`}
            set={set}
            exerciseId={viewModel.exerciseId}
            canEdit={viewModel.canAddSets}
            onUpdateSet={onUpdateSet}
            onCompleteSet={onCompleteSet}
            onRemoveSet={onRemoveSet}
          />
        ))}
      </div>

      {viewModel.canAddSets && (
        <Button
          onClick={handleAddSet}
          size="1"
          variant="ghost"
          mt="3"
          disabled={fetcher.state !== "idle"}
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
  readonly onUpdateSet?: (
    exerciseId: string,
    setNumber: number,
    field: string,
    value: string,
  ) => void;
  readonly onCompleteSet?: (exerciseId: string, setNumber: number) => void;
  readonly onRemoveSet?: (exerciseId: string, setNumber: number) => void;
}

function SetRow({
  set,
  exerciseId,
  canEdit,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
}: SetRowProps) {
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? "");
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? "");
  const [localRpe, setLocalRpe] = useState(set.rpe?.toString() ?? "");
  const fetcher = useFetcher();

  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
    setLocalRpe(set.rpe?.toString() ?? "");
  }, [set.reps, set.weight, set.rpe]);

  const handleUpdateSet = (field: string, value: string) => {
    if (onUpdateSet) {
      onUpdateSet(exerciseId, set.set, field, value);
    }
  };

  const handleCompleteSet = () => {
    if (onCompleteSet) {
      onCompleteSet(exerciseId, set.set);
    }
  };

  const handleRemoveSet = () => {
    if (onRemoveSet) {
      onRemoveSet(exerciseId, set.set);
    }
  };

  const rowClassName = `set-row ${set.isCompleted ? "set-row--completed" : canEdit ? "set-row--pending" : ""}`;

  return (
    <div className={rowClassName}>
      <span className="set-row__number">{set.set}</span>

      {set.isCompleted || !canEdit ? (
        <>
          <Text size="2" className="set-row__value">
            {set.weight ? `${set.weight}` : "—"}
          </Text>
          <Text size="2" className="set-row__value">
            {set.reps ?? "—"}
          </Text>
          <Text size="2" className="set-row__value">
            {set.rpe ?? "—"}
          </Text>
        </>
      ) : (
        <>
          <fetcher.Form
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
                const value = e.target.value;
                setLocalWeight(value);
                handleUpdateSet("weight", value);
              }}
              placeholder="kg"
              size="2"
              variant="surface"
              className="set-row__input"
            />
          </fetcher.Form>
          <fetcher.Form
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
                const value = e.target.value;
                setLocalReps(value);
                handleUpdateSet("reps", value);
              }}
              placeholder="reps"
              size="2"
              variant="surface"
              className="set-row__input"
            />
          </fetcher.Form>
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <NumberInput
              name="rpe"
              value={localRpe}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setLocalRpe(value);
                handleUpdateSet("rpe", value);
              }}
              placeholder="RPE"
              size="2"
              variant="surface"
              className="set-row__input set-row__input--rpe"
            />
          </fetcher.Form>
        </>
      )}

      <div className="set-row__actions">
        {canEdit && !set.isCompleted && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="complete-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <IconButton
              type="submit"
              size="2"
              variant="soft"
              color="green"
              disabled={fetcher.state !== "idle"}
              onClick={handleCompleteSet}
            >
              ✓
            </IconButton>
          </fetcher.Form>
        )}

        {canEdit && (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <IconButton
              type="submit"
              size="1"
              variant="ghost"
              color="red"
              disabled={fetcher.state !== "idle"}
              onClick={handleRemoveSet}
            >
              <TrashIcon />
            </IconButton>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}
