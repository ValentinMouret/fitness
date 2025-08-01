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
import ExerciseTypeBadge from "../ExerciseTypeBadge";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  DotsVerticalIcon,
} from "@radix-ui/react-icons";
import { useFetcher } from "react-router";
import type {
  WorkoutExerciseGroup,
  WorkoutSet,
} from "~/modules/fitness/domain/workout";
import { designTokens } from "~/design-system";

interface WorkoutExerciseCardProps {
  readonly exerciseGroup: WorkoutExerciseGroup;
}

export function WorkoutExerciseCard({
  exerciseGroup,
}: WorkoutExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const fetcher = useFetcher();

  const { exercise, sets, notes } = exerciseGroup;

  const lastSet = sets[sets.length - 1];

  const totalVolume = sets
    .filter((set) => set.isCompleted && set.reps && set.weight)
    .reduce((sum, set) => sum + (set.reps ?? 0) * (set.weight ?? 0), 0);

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
                  {exercise.name}
                </Heading>
                <ExerciseTypeBadge type={exercise.type} />
              </Flex>
            </Flex>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton
                  variant="ghost"
                  size="2"
                  style={{ marginLeft: "8px" }}
                >
                  <DotsVerticalIcon />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item
                  color="red"
                  onSelect={() => {
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
                    exerciseIdInput.value = exercise.id;

                    form.appendChild(intentInput);
                    form.appendChild(exerciseIdInput);
                    document.body.appendChild(form);
                    form.submit();
                  }}
                >
                  <TrashIcon /> Delete Exercise
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
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
              {totalVolume > 0 && (
                <Text size="3" weight="medium" color="gray" mb="1">
                  Total Volume: {totalVolume} kg
                </Text>
              )}
              {notes && (
                <Text size="2" color="gray">
                  {notes}
                </Text>
              )}
            </Box>

            <Box
              mb="4"
              style={{
                border: "1px solid var(--gray-6)",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <Table.Root>
                <Table.Header>
                  <Table.Row style={{ backgroundColor: "var(--gray-2)" }}>
                    <Table.ColumnHeaderCell
                      style={{ textAlign: "right", padding: "12px" }}
                    >
                      Reps
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      style={{ textAlign: "right", padding: "12px" }}
                    >
                      Weight (kg)
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ padding: "12px" }}>
                      Note
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell
                      style={{
                        textAlign: "center",
                        padding: "12px",
                        width: "60px",
                      }}
                    >
                      Actions
                    </Table.ColumnHeaderCell>
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
                size="3"
                variant="soft"
                style={{
                  width: "100%",
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  marginTop: "-1px",
                }}
                disabled={fetcher.state !== "idle"}
              >
                {fetcher.state === "submitting" ? "Adding..." : "Add Set"}
              </Button>
            </fetcher.Form>
          </Box>
        </Flex>
      </Box>
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

  useEffect(() => {
    setLocalReps(set.reps?.toString() ?? "");
    setLocalWeight(set.weight?.toString() ?? "");
    setLocalNote(set.note ?? "");
  }, [set.reps, set.weight, set.note]);

  return (
    <Table.Row
      style={{
        backgroundColor: set.isCompleted ? "var(--green-2)" : undefined,
        minHeight: "48px",
      }}
    >
      <Table.Cell style={{ textAlign: "right", padding: "12px" }}>
        {set.isCompleted ? (
          <Text weight="medium">{set.reps ?? "—"}</Text>
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
              size="2"
              variant="surface"
              style={{
                width: "60px",
                textAlign: "right",
                border: "none",
                backgroundColor: "transparent",
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = designTokens.interactions.hover;
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell style={{ textAlign: "right", padding: "12px" }}>
        {set.isCompleted ? (
          <Text weight="medium">{set.weight ?? "—"}</Text>
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
              size="2"
              variant="surface"
              style={{
                width: "80px",
                textAlign: "right",
                border: "none",
                backgroundColor: "transparent",
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = designTokens.interactions.hover;
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell style={{ padding: "12px" }}>
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
              size="2"
              variant="surface"
              style={{
                width: "120px",
                border: "none",
                backgroundColor: "transparent",
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = designTokens.interactions.hover;
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = "transparent";
              }}
            />
          </fetcher.Form>
        )}
      </Table.Cell>

      <Table.Cell style={{ textAlign: "center", padding: "12px" }}>
        <Flex gap="2" justify="center">
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
                style={{ minHeight: "32px", minWidth: "32px" }}
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
              variant="ghost"
              color="red"
              disabled={fetcher.state !== "idle"}
              style={{ minHeight: "32px", minWidth: "32px" }}
            >
              <TrashIcon />
            </IconButton>
          </fetcher.Form>
        </Flex>
      </Table.Cell>
    </Table.Row>
  );
}
