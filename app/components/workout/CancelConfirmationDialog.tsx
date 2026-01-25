import {
  AlertDialog,
  Box,
  Button,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
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
      <AlertDialog.Content style={{ maxWidth: 400 }}>
        <Heading size="4" mb="2">
          Cancel Workout
        </Heading>

        <Text size="2" color="gray">
          This will permanently delete all workout data.
        </Text>

        <Box py="4" mt="3" style={{ borderTop: "1px solid var(--gray-4)" }}>
          <Flex direction="column" gap="3">
            <Flex justify="between">
              <Text size="2" color="gray">
                Duration
              </Text>
              <Text size="2">{formattedDuration}</Text>
            </Flex>

            <Flex justify="between">
              <Text size="2" color="gray">
                Exercises
              </Text>
              <Text size="2">{workoutSession.exerciseGroups.length}</Text>
            </Flex>

            <Flex justify="between">
              <Text size="2" color="gray">
                Sets completed
              </Text>
              <Text size="2">
                {completedSets} / {totalSets}
              </Text>
            </Flex>
          </Flex>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" size="2" disabled={fetcher.state !== "idle"}>
              Keep
            </Button>
          </AlertDialog.Cancel>

          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="cancel-workout" />
            <Button
              type="submit"
              size="2"
              color="red"
              disabled={fetcher.state !== "idle"}
            >
              {fetcher.state === "submitting" ? "Cancelling..." : "Cancel"}
            </Button>
          </fetcher.Form>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
