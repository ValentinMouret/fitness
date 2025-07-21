import { useState } from "react";
import { Card, Flex, Text, IconButton } from "@radix-ui/themes";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import ExerciseTypeBadge from "~/components/ExerciseTypeBadge";
import { humanFormatting } from "~/strings";

interface ExerciseCardProps {
  readonly exerciseMuscleGroup: ExerciseMuscleGroups;
}

export default function ExerciseCard({
  exerciseMuscleGroup: { exercise, muscleGroupSplits },
}: ExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card>
      <Flex direction="column">
        <Flex
          gap="2"
          align="center"
          justify="between"
          style={{ cursor: "pointer" }}
          onClick={toggleExpanded}
        >
          <Flex gap="2" align="center">
            <ExerciseTypeBadge type={exercise.type} />
            <Text weight="bold">{exercise.name}</Text>
          </Flex>
          <IconButton
            variant="ghost"
            size="1"
            style={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <ChevronDownIcon />
          </IconButton>
        </Flex>
        <div
          style={{
            maxHeight: isExpanded ? "500px" : "0px",
            opacity: isExpanded ? 1 : 0,
            overflow: "hidden",
            transition:
              "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Flex direction="column" gap="2" pt="2">
            <Text color="gray">
              {exercise.description ?? "No description yet"}
            </Text>
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
        </div>
      </Flex>
    </Card>
  );
}
