import { useState, useEffect } from "react";
import {
  Card,
  Flex,
  Text,
  IconButton,
  AlertDialog,
  Button,
} from "@radix-ui/themes";
import { ChevronDownIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Link, useFetcher } from "react-router";
import type { ExerciseMuscleGroups } from "~/modules/fitness/domain/workout";
import { ExerciseTypeBadge } from "~/modules/fitness/presentation/components";
import { humanFormatting } from "~/strings";

interface ExerciseCardProps {
  readonly exerciseMuscleGroup: ExerciseMuscleGroups;
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
          style={{ cursor: "pointer" }}
          onClick={toggleExpanded}
        >
          <Flex gap="2" align="center">
            <ExerciseTypeBadge type={exercise.type} />
            <Text weight="bold">{exercise.name}</Text>
          </Flex>
          <Flex gap="1" align="center">
            <IconButton
              variant="ghost"
              size="1"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link to={`/workouts/exercises/${exercise.id}/edit`}>
                <Pencil1Icon />
              </Link>
            </IconButton>
            <IconButton
              variant="ghost"
              size="1"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <TrashIcon />
            </IconButton>
            <IconButton
              variant="ghost"
              size="1"
              className={`rotating-chevron ${isExpanded ? "rotated" : ""}`}
            >
              <ChevronDownIcon />
            </IconButton>
          </Flex>
        </Flex>
        <div className={`collapsible-section ${isExpanded ? "expanded" : ""}`}>
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

      <AlertDialog.Root
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <AlertDialog.Content>
          <AlertDialog.Title>Delete Exercise</AlertDialog.Title>
          <AlertDialog.Description>
            Are you sure you want to delete "{exercise.name}"? This action
            cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <fetcher.Form method="post" action="/workouts/exercises">
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <Button
                type="submit"
                color="red"
                disabled={fetcher.state === "submitting"}
              >
                {fetcher.state === "submitting" ? "Deleting..." : "Delete"}
              </Button>
            </fetcher.Form>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
}
