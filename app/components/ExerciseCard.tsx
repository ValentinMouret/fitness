import { ChevronDownIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  Flex,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { humanFormatting } from "~/strings";
import "./ExerciseCard.css";

interface ExerciseSummary {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

interface MuscleGroupSplitSummary {
  readonly muscleGroup: string;
  readonly split: number;
}

interface ExerciseCardData {
  readonly exercise: ExerciseSummary;
  readonly muscleGroupSplits: ReadonlyArray<MuscleGroupSplitSummary>;
}

interface ExerciseCardProps {
  readonly exerciseMuscleGroup: ExerciseCardData;
}

export default function ExerciseCard({
  exerciseMuscleGroup: { exercise, muscleGroupSplits },
}: ExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fetcher = useFetcher();

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && showDeleteDialog) {
      setShowDeleteDialog(false);
    }
  }, [fetcher.state, fetcher.data, showDeleteDialog]);

  return (
    <Card>
      <Flex direction="column">
        <Flex
          gap="2"
          align="center"
          justify="between"
          className="exercise-card__header"
          onClick={toggleExpanded}
        >
          <Flex gap="2" align="center">
            <Badge variant="soft" color="gray">
              {humanFormatting(exercise.type)}
            </Badge>
            <Text weight="bold">{exercise.name}</Text>
          </Flex>
          <Flex gap="1" align="center">
            <IconButton
              variant="ghost"
              size="1"
              asChild
              onClick={(event) => event.stopPropagation()}
              aria-label={`Edit ${exercise.name}`}
            >
              <Link to={`/workouts/exercises/${exercise.id}/edit`}>
                <Pencil1Icon />
              </Link>
            </IconButton>
            <IconButton
              variant="ghost"
              size="1"
              color="red"
              onClick={(event) => {
                event.stopPropagation();
                setShowDeleteDialog(true);
              }}
              aria-label={`Delete ${exercise.name}`}
            >
              <TrashIcon />
            </IconButton>
            <IconButton
              variant="ghost"
              size="1"
              className={`rotating-chevron ${isExpanded ? "rotated" : ""}`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              aria-expanded={isExpanded}
            >
              <ChevronDownIcon />
            </IconButton>
          </Flex>
        </Flex>

        {isExpanded && (
          <Flex direction="column" gap="2" pt="3">
            {muscleGroupSplits.length === 0 ? (
              <Text size="2" color="gray">
                No muscle groups configured.
              </Text>
            ) : (
              muscleGroupSplits.map((split) => (
                <Flex key={split.muscleGroup} justify="between">
                  <Text size="2">{humanFormatting(split.muscleGroup)}</Text>
                  <Text size="2" color="gray">
                    {split.split}%
                  </Text>
                </Flex>
              ))
            )}
          </Flex>
        )}
      </Flex>

      <AlertDialog.Root
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>Delete exercise</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Delete {exercise.name}? This action cannot be undone.
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <fetcher.Form method="post">
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <Button type="submit" color="red">
                Delete
              </Button>
            </fetcher.Form>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
}
