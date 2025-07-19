import {
  Button,
  Flex,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { Form, redirect } from "react-router";
import RequiredStar from "~/components/RequiredStar";
import {
  ExerciseMuscleGroupsAggregate,
  exerciseTypes,
  muscleGroups,
  parseExerciseType,
  parseMuscleGroup,
  type Exercise,
  type MuscleGroup,
  type MuscleGroupSplit,
} from "~/modules/fitness/domain/workout";
import { coerceEmpty, humanFormatting } from "~/strings";
import type { Route } from "./+types";
import { InfoCircledIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { coerceInt } from "~/utils";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";

export const action = async ({ request }: Route.ActionArgs) => {
  const form = await request.formData();
  const exerciseName = form.get("name")?.toString();
  const exerciseTypeString = form.get("type")?.toString();
  const exerciseDescription = form.get("description")?.toString();

  if (exerciseName === undefined) {
    throw new Error("Invalid exercise: no name");
  }
  if (exerciseTypeString === undefined) {
    throw new Error("Invalid exercise: no type");
  }
  const exerciseType = parseExerciseType(exerciseTypeString);
  if (exerciseType.isErr()) {
    throw new Error("Invalid exercise: invalid exercise type");
  }

  const muscleGroupSplits: MuscleGroupSplit[] = [];
  let i = 0;
  while (true) {
    const muscleGroupString = form.get(`${i}-muscle-group`)?.toString();
    const splitString = form.get(`${i}-split`)?.toString();

    if (muscleGroupString === undefined) break;
    const muscleGroupName = parseMuscleGroup(muscleGroupString);
    const split = coerceInt(splitString ?? "");

    if (muscleGroupName.isErr()) {
      console.error("Error parsing muscle group", { muscleGroupString });
      throw new Error("Error parsing muscle group");
    }
    if (split.isErr()) {
      console.error("Error parsing split", { split });
      throw new Error("Error parsing split");
    }

    muscleGroupSplits.push({
      muscleGroup: muscleGroupName.value,
      split: split.value,
    });

    i++;
  }

  const exercise: Exercise = {
    name: `${humanFormatting(exerciseName)} (${humanFormatting(exerciseType.value)})`,
    type: exerciseType.value,
    description: coerceEmpty(exerciseDescription ?? ""),
  };
  const muscleGroup = ExerciseMuscleGroupsAggregate.create(
    exercise,
    muscleGroupSplits,
    true,
  );

  if (muscleGroup.isErr()) {
    throw new Error("Invalid muscle group");
  }

  const result = await ExerciseMuscleGroupsRepository.save(muscleGroup.value);
  if (result.isErr()) {
    throw new Error("Error writing to database");
  }

  throw redirect("/workouts/exercises");
};

export default function CreateExercisePage() {
  const [splits, setSplits] = useState<MuscleGroupSplit[]>([]);

  const usedMuscleGroups = new Set(splits.map((s) => s.muscleGroup));
  const availableMuscleGroups = muscleGroups.filter(
    (muscleGroup) => !usedMuscleGroups.has(muscleGroup),
  );

  const addSplit = (split: MuscleGroupSplit) => setSplits([...splits, split]);
  const deleteSplit = (index: number) =>
    setSplits(splits.filter((_, i) => i !== index));
  const createNextSplit = () =>
    addSplit({ muscleGroup: availableMuscleGroups[0], split: 100 }); // TODO(vm): improve
  const updateSplitMuscleGroup = (split: MuscleGroupSplit, index: number) => {
    setSplits(splits.map((s, i) => (i === index ? split : s)));
  };

  return (
    <>
      <Heading size="7">New exercise</Heading>
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
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text as="label" size="2" weight="medium">
              Type <RequiredStar />
            </Text>
            <Select.Root required name="type" defaultValue="barbell">
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
            <TextField.Root name="description" type="text" />
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
                      <TextField.Root
                        type="number"
                        step="1"
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

          <Button>Create</Button>
        </Flex>
      </Form>
    </>
  );
}
