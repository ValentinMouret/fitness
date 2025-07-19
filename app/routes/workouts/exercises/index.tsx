import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import type { Route } from "./+types";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import { Link } from "react-router";
import ExerciseTypeBadge from "~/components/ExerciseTypeBadge";
import { humanFormatting } from "~/strings";

export const loader = async () => {
  const allExercises = await ExerciseMuscleGroupsRepository.listAll();

  if (allExercises.isErr()) {
    throw new Error("Error fetching exercises");
  }

  return {
    allExercises: allExercises.value,
  };
};

export const action = () => {};

interface ExerciseCardProps {
  readonly exerciseMuscleGroup: ExerciseMuscleGroups;
}

export function ExerciseCard({
  exerciseMuscleGroup: { exercise, muscleGroupSplits },
}: ExerciseCardProps) {
  return (
    <Card>
      <Flex direction="column">
        <Flex gap="2" align="center">
          <ExerciseTypeBadge type={exercise.type} />
          <Text weight="bold">{exercise.name}</Text>
        </Flex>
        <Text color="gray">{exercise.description ?? "No description yet"}</Text>
        <Flex direction="row" gap="3">
          {muscleGroupSplits
            .toSorted((a, b) => b.split - a.split)
            .map(({ muscleGroup, split }) => (
              <Text key={muscleGroup}>
                {humanFormatting(muscleGroup)} ({split}%)
              </Text>
            ))}
        </Flex>
      </Flex>
    </Card>
  );
}

export default function ExercisesIndexPage({
  loaderData,
}: Route.ComponentProps) {
  const { allExercises } = loaderData;
  return (
    <>
      <Flex gap="3">
        <Heading>Exercises</Heading>
        <Button asChild>
          <Link to="/workouts/exercises/create">Add exercise</Link>
        </Button>
      </Flex>
      {allExercises.length === 0 ? (
        <Text>Exercises will show here once you add them</Text>
      ) : (
        <Flex direction="column" pt="4" gap="2">
          {allExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.exercise.name}
              exerciseMuscleGroup={exercise}
            />
          ))}
        </Flex>
      )}
    </>
  );
}
