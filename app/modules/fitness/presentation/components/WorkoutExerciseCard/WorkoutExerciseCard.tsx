import { useState, useEffect } from "react";
import {
  Card,
  Flex,
  Text,
  Button,
  IconButton,
  Heading,
  Box,
  Table,
  TextField,
  DropdownMenu,
} from "@radix-ui/themes";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  DotsVerticalIcon,
} from "@radix-ui/react-icons";
import { Brain } from "lucide-react";
import { useFetcher } from "react-router";
import type {
  WorkoutExerciseCardViewModel,
  WorkoutSetViewModel,
} from "../../view-models/workout-exercise-card.view-model";
import { ExerciseTypeBadge } from "../ExerciseTypeBadge";
import { designTokens } from "~/design-system";

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
  const [isExpanded, setIsExpanded] = useState(true);
  const fetcher = useFetcher();

  const handleAddSet = () => {
    if (onAddSet) {
      onAddSet(viewModel.exerciseId, viewModel.lastSet);
    } else {
      const form = document.createElement("form");
      form.method = "post";
      form.style.display = "none";

      const intentInput = document.createElement("input");
      intentInput.type = "hidden";
      intentInput.name = "intent";
      intentInput.value = "add-set";

      const exerciseIdInput = document.createElement("input");
      exerciseIdInput.type = "hidden";
      exerciseIdInput.name = "exerciseId";
      exerciseIdInput.value = viewModel.exerciseId;

      if (viewModel.lastSet) {
        const repsInput = document.createElement("input");
        repsInput.type = "hidden";
        repsInput.name = "reps";
        repsInput.value = viewModel.lastSet.reps?.toString() ?? "";

        const weightInput = document.createElement("input");
        weightInput.type = "hidden";
        weightInput.name = "weight";
        weightInput.value = viewModel.lastSet.weight?.toString() ?? "";

        form.appendChild(repsInput);
        form.appendChild(weightInput);
      }

      form.appendChild(intentInput);
      form.appendChild(exerciseIdInput);
      document.body.appendChild(form);
      form.submit();
    }
  };

  const handleRemoveExercise = () => {
    if (onRemoveExercise) {
      onRemoveExercise(viewModel.exerciseId);
    } else {
      const form = document.createElement("form");
      form.method = "post";
      form.style.display = "none";

      const intentInput = document.createElement("input");
      intentInput.type = "hidden";
      intentInput.name = "intent";
      intentInput.value = "remove-exercise";

      const exerciseIdInput = document.createElement("input");
      exerciseIdInput.type = "hidden";
      exerciseIdInput.name = "exerciseId";
      exerciseIdInput.value = viewModel.exerciseId;

      form.appendChild(intentInput);
      form.appendChild(exerciseIdInput);
      document.body.appendChild(form);
      form.submit();
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card mb="4">
      <Box p="4">
        <Flex direction="column">
          <Flex justify="between" align="start" mb="4">
            <Flex
              gap="3"
              align="center"
              style={{ cursor: "pointer", flex: 1 }}
              onClick={toggleExpanded}
            >
              <IconButton
                variant="ghost"
                size="3"
                style={{
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: `transform ${designTokens.transitions.normal}`,
                }}
              >
                {isExpanded ? (
                  <ChevronDownIcon width="20" height="20" />
                ) : (
                  <ChevronRightIcon width="20" height="20" />
                )}
              </IconButton>
              <Flex align="center" gap="3" style={{ flex: 1 }}>
                <Heading size="6" weight="bold">
                  {viewModel.exerciseName}
                </Heading>
                <ExerciseTypeBadge type={viewModel.exerciseType} />
              </Flex>
            </Flex>

            {viewModel.canRemoveExercise && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <IconButton variant="ghost" size="2">
                    <DotsVerticalIcon />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    color="red"
                    onSelect={handleRemoveExercise}
                  >
                    <TrashIcon /> Delete Exercise
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            )}
          </Flex>

          <Box
            style={{
              maxHeight: isExpanded ? "1000px" : "0px",
              opacity: isExpanded ? 1 : 0,
              overflow: "hidden",
              transition: `max-height ${designTokens.transitions.normal}, opacity ${designTokens.transitions.normal}`,
            }}
          >
            <Box>
              {viewModel.totalVolumeDisplay && (
                <Text size="3" weight="medium" color="gray" mb="1">
                  Total Volume: {viewModel.totalVolumeDisplay}
                </Text>
              )}
              {viewModel.mmcInstructions && (
                <Flex align="start" gap="2" mb="2">
                  <Brain
                    size={16}
                    style={{
                      color: "var(--purple-9)",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    size="2"
                    color="purple"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {viewModel.mmcInstructions}
                  </Text>
                </Flex>
              )}
              {viewModel.notes && (
                <Text size="2" color="gray">
                  {viewModel.notes}
                </Text>
              )}
            </Box>

            <Box mb="4">
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Set</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end">
                      Reps
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="end">
                      Weight (kg)
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell justify="center">
                      Actions
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {viewModel.sets.map((set) => (
                    <EditableSetRow
                      key={`${viewModel.exerciseId}-${set.set}`}
                      set={set}
                      exerciseId={viewModel.exerciseId}
                      canEdit={viewModel.canAddSets}
                      onUpdateSet={onUpdateSet}
                      onCompleteSet={onCompleteSet}
                      onRemoveSet={onRemoveSet}
                    />
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>

            {viewModel.canAddSets && (
              <Button
                onClick={handleAddSet}
                size="3"
                variant="soft"
                style={{ width: "100%" }}
                disabled={fetcher.state !== "idle"}
              >
                {fetcher.state === "submitting" ? "Adding..." : "Add Set"}
              </Button>
            )}
          </Box>
        </Flex>
      </Box>
    </Card>
  );
}

interface EditableSetRowProps {
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

function EditableSetRow({
  set,
  exerciseId,
  canEdit,
  onUpdateSet,
  onCompleteSet,
  onRemoveSet,
}: EditableSetRowProps) {
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? "");
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? "");
  const [localNote, setLocalNote] = useState(set.note ?? "");
  const fetcher = useFetcher();

  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
    setLocalNote(set.note ?? "");
  }, [set.reps, set.weight, set.note]);

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

  return (
    <Table.Row
      style={{
        backgroundColor: set.isCompleted
          ? "var(--green-2)"
          : set.isWarmup
            ? "var(--orange-2)"
            : "transparent",
        opacity: set.isCompleted ? 1 : 0.9,
      }}
    >
      <Table.Cell>
        <Text weight="medium" color={set.isWarmup ? "orange" : undefined}>
          {set.isWarmup ? `W${set.set}` : `Set ${set.set}`}
        </Text>
      </Table.Cell>

      <Table.Cell justify="end">
        {set.isCompleted || !canEdit ? (
          <Text weight="medium">{set.repsDisplay}</Text>
        ) : (
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
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
              placeholder="0"
              size="2"
              variant="surface"
              style={{
                textAlign: "right",
                maxWidth: "80px",
                marginLeft: "auto",
              }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell justify="end">
        {set.isCompleted || !canEdit ? (
          <Text weight="medium">{set.weightDisplay}</Text>
        ) : (
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
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
              placeholder="0"
              size="2"
              variant="surface"
              style={{
                textAlign: "right",
                maxWidth: "80px",
                marginLeft: "auto",
              }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell>
        {set.isCompleted || !canEdit ? (
          <Text>{set.noteDisplay}</Text>
        ) : (
          <fetcher.Form
            method="post"
            onChange={(e) => e.currentTarget.requestSubmit()}
          >
            <input type="hidden" name="intent" value="update-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <TextField.Root
              name="note"
              value={localNote}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setLocalNote(value);
                handleUpdateSet("note", value);
              }}
              placeholder="Add note..."
              size="2"
              variant="surface"
              style={{ minWidth: "120px" }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell justify="center">
        <Flex gap="2" justify="center" align="center">
          {!set.isCompleted && canEdit && (
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
                size="2"
                variant="ghost"
                color="red"
                disabled={fetcher.state !== "idle"}
                onClick={handleRemoveSet}
              >
                <TrashIcon />
              </IconButton>
            </fetcher.Form>
          )}
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}
