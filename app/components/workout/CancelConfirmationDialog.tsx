import {
  AlertDialog,
  Box,
  Button,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { Form, useNavigation } from "react-router";
import { useLiveDuration } from "./useLiveDuration";

interface WorkoutSummarySet {
  readonly isCompleted: boolean;
}

interface WorkoutSummaryGroup {
  readonly sets: ReadonlyArray<WorkoutSummarySet>;
}

interface CancelWorkoutSession {
  readonly workout: {
    readonly start: Date;
    readonly stop?: Date;
  };
  readonly exerciseGroups: ReadonlyArray<WorkoutSummaryGroup>;
}

interface CancelConfirmationDialogProps {
  readonly workoutSession: CancelWorkoutSession;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CancelConfirmationDialog({
  workoutSession,
  open,
  onOpenChange,
}: CancelConfirmationDialogProps) {
  const navigation = useNavigation();
  const isCancelling =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "cancel-workout";
  const isBusy = navigation.state !== "idle";

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
            <Button variant="soft" size="2" disabled={isBusy}>
              Keep
            </Button>
          </AlertDialog.Cancel>

          <Form method="post">
            <input type="hidden" name="intent" value="cancel-workout" />
            <Button type="submit" size="2" color="red" disabled={isBusy}>
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          </Form>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
