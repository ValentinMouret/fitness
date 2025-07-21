import { Card, Flex, Text } from "@radix-ui/themes";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import ExerciseTypeBadge from "~/components/ExerciseTypeBadge";
import { humanFormatting } from "~/strings";

interface ExerciseCardProps {
  readonly exerciseMuscleGroup: ExerciseMuscleGroups;
}

export default function ExerciseCard({
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
