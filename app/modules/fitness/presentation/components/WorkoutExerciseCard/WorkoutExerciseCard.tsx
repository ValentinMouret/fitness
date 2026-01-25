import { DotsVerticalIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type {
  WorkoutExerciseCardViewModel,
  WorkoutSetViewModel,
} from "../../view-models/workout-exercise-card.view-model";

interface WorkoutExerciseCardProps {
  readonly viewModel: WorkoutExerciseCardViewModel;
  readonly onAddSet?: (
    exerciseId: string,
    lastSet?: WorkoutSetViewModel,
  ) => void;
  readonly onRemoveExercise?: (exerciseId: string) => void;
  readonly onUpdateSet?: (
    exerciseId: string,
    setNumber: number,
    field: string,
    value: string,
  ) => void;
  readonly onCompleteSet?: (exerciseId: string, setNumber: number) => void;
  readonly onRemoveSet?: (exerciseId: string, setNumber: number) => void;
}

export function WorkoutExerciseCard({
  viewModel,
  onAddSet,
  onRemoveExercise,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
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
    <Box py="5" style={{ borderBottom: "1px solid var(--gray-4)" }}>
      <Flex justify="between" align="start" mb="1">
        <Text size="3" weight="medium">
          {viewModel.exerciseName}
        </Text>

        {viewModel.canRemoveExercise && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1">
                <DotsVerticalIcon />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item color="red" onSelect={handleRemoveExercise}>
                <TrashIcon /> Delete Exercise
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </Flex>

      <Text size="1" color="gray" style={{ display: "block" }}>
        {viewModel.exerciseType}
      </Text>

      {viewModel.mmcInstructions && (
        <Text
          size="2"
          color="gray"
          mt="2"
          style={{ display: "block", fontStyle: "italic" }}
        >
          {viewModel.mmcInstructions}
        </Text>
      )}

      <Box mt="4" style={{ fontVariantNumeric: "tabular-nums" }}>
        {viewModel.sets.map((set, index) => (
          <SetRow
            key={`${viewModel.exerciseId}-${set.set}`}
            set={set}
            exerciseId={viewModel.exerciseId}
            canEdit={viewModel.canAddSets}
            isFirst={index === 0}
            onUpdateSet={onUpdateSet}
            onCompleteSet={onCompleteSet}
            onRemoveSet={onRemoveSet}
          />
        ))}
      </Box>

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
    </Box>
  );
}

interface SetRowProps {
  readonly set: WorkoutSetViewModel;
  readonly exerciseId: string;
  readonly canEdit: boolean;
  readonly isFirst: boolean;
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
  isFirst,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
}: SetRowProps) {
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? "");
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? "");
  const fetcher = useFetcher();

  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
  }, [set.reps, set.weight]);

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

  const rowStyle = {
    borderTop: isFirst ? undefined : "1px solid var(--gray-3)",
    backgroundColor: set.isCompleted ? "var(--green-2)" : undefined,
  };

  return (
    <Flex align="center" py="2" gap="3" style={rowStyle}>
      <Text size="2" color="gray" style={{ width: 24, flexShrink: 0 }}>
        {set.set}
      </Text>

      {set.isCompleted || !canEdit ? (
        <>
          <Text size="2" style={{ width: 64, flexShrink: 0 }}>
            {set.weight ? `${set.weight} kg` : "—"}
          </Text>
          <Text size="2" color="gray" style={{ flexShrink: 0 }}>
            ×
          </Text>
          <Text size="2" style={{ width: 64, flexShrink: 0 }}>
            {set.reps ?? "—"}
          </Text>
        </>
      ) : (
        <>
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
            style={{ width: 64, flexShrink: 0 }}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <TextField.Root
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
              style={{ textAlign: "right" }}
            />
          </fetcher.Form>
          <Text size="2" color="gray" style={{ flexShrink: 0 }}>
            ×
          </Text>
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
            style={{ width: 64, flexShrink: 0 }}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <TextField.Root
              name="reps"
              value={localReps}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setLocalReps(value);
                handleUpdateSet("reps", value);
              }}
              placeholder="reps"
              size="2"
              variant="surface"
              style={{ textAlign: "right" }}
            />
          </fetcher.Form>
        </>
      )}

      {set.isWarmup && (
        <Text size="1" color="gray">
          warmup
        </Text>
      )}

      {canEdit && (
        <Flex gap="2" align="center">
          {!set.isCompleted && (
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

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <IconButton
              type="submit"
              size="2"
              variant="soft"
              color="red"
              disabled={fetcher.state !== "idle"}
              onClick={handleRemoveSet}
            >
              <TrashIcon />
            </IconButton>
          </fetcher.Form>
        </Flex>
      )}
    </Flex>
  );
}
