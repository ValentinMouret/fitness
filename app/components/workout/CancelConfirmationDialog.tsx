import { AlertDialog, Button, Flex, Text, Card, Box } from "@radix-ui/themes";
import { useFetcher } from "react-router";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";
import { useLiveDuration } from "./useLiveDuration";

interface CancelConfirmationDialogProps {
  readonly workoutSession: WorkoutSession;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CancelConfirmationDialog({
  workoutSession,
  open,
  onOpenChange,
}: CancelConfirmationDialogProps) {
  const fetcher = useFetcher();

  const { formattedDuration } = useLiveDuration({
    startTime: workoutSession.workout.start,
    endTime: workoutSession.workout.stop,
  });

  const totalSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.length,
    0,
  );

  const completedSets = workoutSession.exerciseGroups.reduce(
    (sum, group) => sum + group.sets.filter((set) => set.isCompleted).length,
    0,
  );

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content style={{ maxWidth: "500px" }}>
        <AlertDialog.Title>Cancel Workout</AlertDialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <AlertDialog.Description>
            <Text size="3">
              Are you sure you want to cancel your workout? This action cannot
              be undone.
            </Text>
          </AlertDialog.Description>

          {/* Workout Summary */}
          <Card>
            <Text weight="bold" size="2" mb="2" as="div">
              Workout Summary
            </Text>
            <Flex direction="column" gap="1">
              <Flex justify="between">
                <Text size="2">Duration:</Text>
                <Text size="2" weight="bold">
                  {formattedDuration}
                </Text>
              </Flex>
              <Flex justify="between">
                <Text size="2">Exercises added:</Text>
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
              <input type="hidden" name="intent" value="cancel-workout" />
              <Button
                type="submit"
                color="red"
                disabled={fetcher.state !== "idle"}
              >
                {fetcher.state === "submitting"
                  ? "Cancelling..."
                  : "Cancel Workout"}
              </Button>
            </fetcher.Form>
          </Flex>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
