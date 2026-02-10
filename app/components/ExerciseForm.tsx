import { InfoCircledIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
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
import { useState } from "react";
import { Form } from "react-router";
import { NumberInput } from "~/components/NumberInput";
import RequiredStar from "~/components/RequiredStar";
import {
  type Exercise,
  exerciseTypes,
  type MuscleGroup,
  type MuscleGroupSplit,
  muscleGroups,
} from "~/modules/fitness/domain/workout";
import { humanFormatting } from "~/strings";

interface ExerciseFormProps {
  readonly initialExercise?: Exercise;
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
  const availableMuscleGroups = muscleGroups.filter(
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

  return (
    <Form method="post">
      <Flex direction="column" gap="2" pt="4">
        <Flex direction="column" gap="2">
          <Text as="label" size="2" weight="medium">
            Name <RequiredStar />
          </Text>
          <TextField.Root
            name="name"
            type="text"
            placeholder="Chest press"
            required
            defaultValue={initialExercise?.name}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" size="2" weight="medium">
            Type <RequiredStar />
          </Text>
          <Select.Root
            required
            name="type"
            defaultValue={initialExercise?.type ?? "barbell"}
          >
            <Select.Trigger />
            <Select.Content>
              {exerciseTypes.map((exerciseType) => (
                <Select.Item key={exerciseType} value={exerciseType}>
                  {humanFormatting(exerciseType)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" size="2" weight="medium">
            Description
          </Text>
          <TextField.Root
            name="description"
            type="text"
            defaultValue={initialExercise?.description}
          />
        </Flex>

        <Flex direction="column" gap="2">
          <Text as="label" size="2" weight="medium">
            Mind-Muscle Connection
          </Text>
          <TextArea
            name="mmcInstructions"
            placeholder="Focus cues to engage target muscles, e.g. 'Squeeze at the top', 'Feel the stretch at the bottom'"
            defaultValue={initialExercise?.mmcInstructions}
            rows={3}
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
                      <IconButton variant="ghost" color="gray">
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
                      onValueChange={(v) =>
                        updateSplitMuscleGroup(
                          {
                            ...muscleGroupSplit,
                            muscleGroup: v as MuscleGroup,
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
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      type="button"
                      variant="outline"
                      color="red"
                      onClick={() => deleteSplit(index)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <Button
            disabled={availableMuscleGroups.length === 0}
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

        <Button>{mode === "create" ? "Create" : "Update"}</Button>
      </Flex>
    </Form>
  );
}
