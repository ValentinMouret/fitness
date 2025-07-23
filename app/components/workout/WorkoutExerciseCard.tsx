import { useState, useEffect } from "react";
import {
  Card,
  Flex,
  Text,
  Button,
  Badge,
  IconButton,
  Heading,
  Box,
  Table,
  TextField,
} from "@radix-ui/themes";
import { ChevronRightIcon, TrashIcon } from "@radix-ui/react-icons";
import { useFetcher } from "react-router";
import type {
  WorkoutExerciseGroup,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";

interface WorkoutExerciseCardProps {
  readonly exerciseGroup: WorkoutExerciseGroup;
}

export function WorkoutExerciseCard({
  exerciseGroup,
}: WorkoutExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const fetcher = useFetcher();

  const { exercise, sets, notes, orderIndex } = exerciseGroup;

  // Get the last set for smart defaults
  const lastSet = sets[sets.length - 1];

  // Calculate total volume (sum of reps × weight for completed sets)
  const totalVolume = sets
    .filter((set) => set.isCompleted && set.reps && set.weight)
    .reduce((sum, set) => sum + (set.reps ?? 0) * (set.weight ?? 0), 0);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card mb="4">
      <Flex direction="column">
        {/* Exercise Header */}
        <Flex justify="between" align="center" mb="3">
          <Flex
            gap="2"
            align="center"
            style={{ cursor: "pointer" }}
            onClick={toggleExpanded}
          >
            <IconButton
              variant="ghost"
              size="1"
              style={{
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              <ChevronRightIcon />
            </IconButton>
            <Box>
              <Heading size="4">{exercise.name}</Heading>
              <Flex gap="2" align="center">
                <Badge variant="soft">{exercise.type}</Badge>
                {notes && (
                  <Text size="2" color="gray">
                    {notes}
                  </Text>
                )}
              </Flex>
            </Box>
          </Flex>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-exercise" />
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <IconButton
              type="submit"
              variant="soft"
              color="red"
              size="2"
              disabled={fetcher.state !== "idle"}
            >
              <TrashIcon />
            </IconButton>
          </fetcher.Form>
        </Flex>

        {/* Collapsible Content */}
        <Box
          style={{
            maxHeight: isExpanded ? "1000px" : "0px",
            opacity: isExpanded ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease, opacity 0.3s ease",
          }}
        >
          {/* Total Volume */}
          <Box mb="3">
            <Text size="2" weight="medium" color="gray">
              Total Volume: {totalVolume} kg
            </Text>
          </Box>

          {/* Sets Table */}
          <Box mb="3">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Reps</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Weight (kg)</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sets.map((set) => (
                  <EditableSetRow
                    key={`${exercise.id}-${set.set}`}
                    set={set}
                    exerciseId={exercise.id}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          {/* Add Set Button */}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="add-set" />
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <input
              type="hidden"
              name="reps"
              value={lastSet?.reps?.toString() ?? ""}
            />
            <input
              type="hidden"
              name="weight"
              value={lastSet?.weight?.toString() ?? ""}
            />
            <Button
              type="submit"
              size="2"
              variant="soft"
              style={{ width: "100%" }}
              disabled={fetcher.state !== "idle"}
            >
              {fetcher.state === "submitting" ? "Adding..." : "Add Set"}
            </Button>
          </fetcher.Form>
        </Box>
      </Flex>
    </Card>
  );
}

interface EditableSetRowProps {
  readonly set: WorkoutSet;
  readonly exerciseId: string;
}

function EditableSetRow({ set, exerciseId }: EditableSetRowProps) {
  const [localReps, setLocalReps] = useState(set.reps?.toString() ?? "");
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() ?? "");
  const [localNote, setLocalNote] = useState(set.note ?? "");
  const fetcher = useFetcher();

  // Update local state when props change (after successful update)
  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
    setLocalNote(set.note ?? "");
  }, [set.reps, set.weight, set.note]);

  return (
    <Table.Row
      style={{
        backgroundColor: set.isCompleted ? "#f0fdf4" : undefined,
        opacity: set.isCompleted ? 0.7 : 1,
      }}
    >
      <Table.Cell>
        {set.isCompleted ? (
          <Text>{set.reps ?? "—"}</Text>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalReps(e.target.value)
              }
              placeholder="0"
              size="1"
              style={{ width: "60px" }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell>
        {set.isCompleted ? (
          <Text>{set.weight ?? "—"}</Text>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalWeight(e.target.value)
              }
              placeholder="0"
              size="1"
              style={{ width: "80px" }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell>
        {set.isCompleted ? (
          <Text>{set.note ?? "—"}</Text>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLocalNote(e.target.value)
              }
              placeholder="Note"
              size="1"
              style={{ width: "120px" }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell>
        <Flex gap="1">
          {!set.isCompleted && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="complete-set" />
              <input type="hidden" name="exerciseId" value={exerciseId} />
              <input type="hidden" name="setNumber" value={set.set} />
              <Button
                type="submit"
                size="1"
                variant="soft"
                color="green"
                disabled={fetcher.state !== "idle"}
              >
                ✓
              </Button>
            </fetcher.Form>
          )}

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-set" />
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="setNumber" value={set.set} />
            <Button
              type="submit"
              size="1"
              variant="soft"
              color="red"
              disabled={fetcher.state !== "idle"}
            >
              <TrashIcon />
            </Button>
          </fetcher.Form>
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}
