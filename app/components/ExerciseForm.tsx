import { InfoCircledIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Flex,
  IconButton,
  Select,
  Table,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { NumberInput } from "~/components/NumberInput";
import RequiredStar from "~/components/RequiredStar";
import { humanFormatting } from "~/strings";

const EXERCISE_TYPES = [
  "barbell",
  "bodyweight",
  "cable",
  "dumbbells",
  "machine",
] as const;

const MUSCLE_GROUPS = [
  "abs",
  "armstrings",
  "biceps",
  "calves",
  "delts",
  "forearm",
  "glutes",
  "lats",
  "lower_back",
  "pecs",
  "quads",
  "trapezes",
  "triceps",
] as const;

type ExerciseFormExerciseType = (typeof EXERCISE_TYPES)[number];
type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface ExerciseFormExercise {
  readonly id: string;
  readonly name: string;
  readonly type: ExerciseFormExerciseType;
  readonly description?: string;
  readonly mmcInstructions?: string;
}

interface MuscleGroupSplit {
  readonly muscleGroup: MuscleGroup;
  readonly split: number;
}

interface ExerciseFormProps {
  readonly initialExercise?: ExerciseFormExercise;
  readonly initialSplits?: ReadonlyArray<MuscleGroupSplit>;
  readonly mode: "create" | "edit";
}

export default function ExerciseForm({
  initialExercise,
  initialSplits = [],
  mode,
}: ExerciseFormProps) {
  const [splits, setSplits] = useState<MuscleGroupSplit[]>([...initialSplits]);

  const usedMuscleGroups = new Set(splits.map((s) => s.muscleGroup));
  const availableMuscleGroups = MUSCLE_GROUPS.filter(
    (muscleGroup) => !usedMuscleGroups.has(muscleGroup),
  );

  const addSplit = (split: MuscleGroupSplit) => setSplits([...splits, split]);
  const deleteSplit = (index: number) =>
    setSplits(splits.filter((_, i) => i !== index));
  const createNextSplit = () =>
    addSplit({ muscleGroup: availableMuscleGroups[0], split: 100 });
  const updateSplitMuscleGroup = (split: MuscleGroupSplit, index: number) => {
    setSplits(splits.map((s, i) => (i === index ? split : s)));
  };

  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const nameId = useId();
  const typeId = useId();
  const descriptionId = useId();
  const mmcId = useId();

  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (formRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Form ref={formRef} method="post">
      <Flex direction="column" gap="2" pt="4">
        <Flex direction="column" gap="2">
          <Text as="label" htmlFor={nameId} size="2" weight="medium">
            Name <RequiredStar />
          </Text>
          <TextField.Root
            ref={nameInputRef}
            id={nameId}
            name="name"
            type="text"
            placeholder="Chest press"
            required
            defaultValue={initialExercise?.name}
            disabled={isSubmitting}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" htmlFor={typeId} size="2" weight="medium">
            Type <RequiredStar />
          </Text>
          <Select.Root
            required
            name="type"
            defaultValue={initialExercise?.type ?? "barbell"}
            disabled={isSubmitting}
          >
            <Select.Trigger id={typeId} />
            <Select.Content>
              {EXERCISE_TYPES.map((exerciseType) => (
                <Select.Item key={exerciseType} value={exerciseType}>
                  {humanFormatting(exerciseType)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" htmlFor={descriptionId} size="2" weight="medium">
            Description
          </Text>
          <TextField.Root
            id={descriptionId}
            name="description"
            type="text"
            defaultValue={initialExercise?.description}
            disabled={isSubmitting}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" htmlFor={mmcId} size="2" weight="medium">
            Mind-Muscle Connection
          </Text>
          <TextArea
            id={mmcId}
            name="mmcInstructions"
            placeholder="Focus cues to engage target muscles, e.g. 'Squeeze at the top', 'Feel the stretch at the bottom'"
            defaultValue={initialExercise?.mmcInstructions}
            rows={3}
            disabled={isSubmitting}
          />
        </Flex>

        <Flex direction="column" gap="2" pt="4">
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Muscle Group</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Flex align="center" gap="1">
                    <Text>Split</Text>
                    <Tooltip content="These will be normalized to percents">
                      <IconButton
                        variant="ghost"
                        color="gray"
                        aria-label="Muscle group split information"
                      >
                        <InfoCircledIcon />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {splits.map((muscleGroupSplit, index) => (
                <Table.Row key={muscleGroupSplit.muscleGroup}>
                  <Table.RowHeaderCell>
                    <Select.Root
                      required
                      name={`${index}-muscle-group`}
                      defaultValue={muscleGroupSplit.muscleGroup}
                      disabled={isSubmitting}
                      onValueChange={(value) =>
                        updateSplitMuscleGroup(
                          {
                            ...muscleGroupSplit,
                            muscleGroup: value as MuscleGroup,
                          },
                          index,
                        )
                      }
                    >
                      <Select.Trigger />
                      <Select.Content>
                        {[
                          muscleGroupSplit.muscleGroup,
                          ...availableMuscleGroups,
                        ].map((muscleGroup) => (
                          <Select.Item key={muscleGroup} value={muscleGroup}>
                            {humanFormatting(muscleGroup)}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <NumberInput
                      allowDecimals={false}
                      min="0"
                      max="100"
                      name={`${index}-split`}
                      defaultValue={muscleGroupSplit.split}
                      disabled={isSubmitting}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      type="button"
                      variant="outline"
                      color="red"
                      onClick={() => deleteSplit(index)}
                      aria-label="Delete muscle group split"
                      disabled={isSubmitting}
                    >
                      <TrashIcon />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <Button
            disabled={availableMuscleGroups.length === 0 || isSubmitting}
            type="button"
            variant="soft"
            onClick={createNextSplit}
          >
            <Flex direction="row" align="center">
              <PlusIcon height="20" width="20" />
              <Text>Add Split</Text>
            </Flex>
          </Button>
        </Flex>

        <Tooltip
          content={`${mode === "create" ? "Create" : "Update"} exercise (Cmd+Enter)`}
        >
          <Box display="inline-block" style={{ width: "100%" }} mt="4">
            <Button
              type="submit"
              loading={isSubmitting}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              style={{ width: "100%" }}
            >
              {mode === "create" ? "Create Exercise" : "Update Exercise"}
            </Button>
          </Box>
        </Tooltip>
      </Flex>
    </Form>
  );
}
