import { AlertDialog, Button, Flex, Text, Card, Box } from "@radix-ui/themes";
import { useFetcher } from "react-router";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";

interface DeleteConfirmationDialogProps {
  readonly workoutSession: WorkoutSession;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmationDialog({
  workoutSession,
  open,
  onOpenChange,
}: DeleteConfirmationDialogProps) {
  const fetcher = useFetcher();

  const totalSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.length,
    0,
  );

  const completedSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.filter((set) => set.isCompleted).length,
    0,
  );

  const completionDate = workoutSession.workout.stop
    ?.toISOString()
    .split("T")[0];

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content style={{ maxWidth: "500px" }}>
        <AlertDialog.Title>Delete Workout</AlertDialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <AlertDialog.Description>
            <Text size="3">
              Are you sure you want to delete this completed workout? This
              action cannot be undone.
            </Text>
          </AlertDialog.Description>

          {/* Workout Summary */}
          <Card>
            <Text weight="bold" size="2" mb="2" as="div">
              Workout Summary
            </Text>
            <Flex direction="column" gap="1">
              <Flex justify="between">
                <Text size="2">Completed on:</Text>
                <Text size="2" weight="bold">
                  {completionDate}
                </Text>
              </Flex>
              <Flex justify="between">
                <Text size="2">Exercises completed:</Text>
                <Text size="2" weight="bold">
                  {workoutSession.exerciseGroups.length}
                </Text>
              </Flex>
              <Flex justify="between">
                <Text size="2">Sets completed:</Text>
                <Text size="2" weight="bold">
                  {completedSets} / {totalSets}
                </Text>
              </Flex>
            </Flex>
          </Card>

          <Box>
            <Text size="3" weight="bold" color="red" as="div">
              ⚠️ All workout data will be permanently lost
            </Text>
          </Box>

          {/* Action Buttons */}
          <Flex gap="3" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" disabled={fetcher.state !== "idle"}>
                Keep Workout
              </Button>
            </AlertDialog.Cancel>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-workout" />
              <Button
                type="submit"
                color="red"
                disabled={fetcher.state !== "idle"}
              >
                {fetcher.state === "submitting"
                  ? "Deleting..."
                  : "Delete Workout"}
              </Button>
            </fetcher.Form>
          </Flex>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
