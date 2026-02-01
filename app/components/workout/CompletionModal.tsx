import { Box, Button, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { Form, useNavigation } from "react-router";
import type { WorkoutSession } from "~/modules/fitness/domain/workout";
import { useLiveDuration } from "./useLiveDuration";

interface CompletionModalProps {
  readonly workoutSession: WorkoutSession;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CompletionModal({
  workoutSession,
  open,
  onOpenChange,
}: CompletionModalProps) {
  const navigation = useNavigation();
  const isCompleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "complete-workout";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 400 }}>
        <Heading size="4" mb="4">
          Complete Workout
        </Heading>

        <Box py="4" style={{ borderTop: "1px solid var(--gray-4)" }}>
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
                Sets
              </Text>
              <Text size="2">
                {completedSets} / {totalSets}
              </Text>
            </Flex>
          </Flex>
        </Box>

        <Flex gap="3" mt="4" justify="end">
          <Button
            variant="soft"
            size="2"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Continue
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="complete-workout" />
            <Button type="submit" size="2" disabled={isBusy}>
              {isCompleting ? "Completing..." : "Finish"}
            </Button>
          </Form>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
