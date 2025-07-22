import {
  Dialog,
  Button,
  Flex,
  Text,
  Heading,
  Card,
  Box,
} from "@radix-ui/themes";
import { Link, useFetcher } from "react-router";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: "500px" }}>
        <Flex direction="column" align="center" gap="4">
          <Box style={{ textAlign: "center" }}>
            <Text size="8" style={{ fontSize: "4rem" }}>
              🎉
            </Text>
            <Heading size="6" mt="2" mb="2">
              Workout Complete!
            </Heading>
            <Text size="3" color="gray">
              Great job on finishing your workout!
            </Text>
          </Box>

          {/* Workout Summary */}
          <Card style={{ width: "100%" }}>
            <Heading size="4" mb="3">
              {workoutSession.workout.name}
            </Heading>

            <Flex direction="column" gap="2">
              <Flex justify="between">
                <Text>Duration:</Text>
                <Text weight="bold">{formattedDuration}</Text>
              </Flex>

              <Flex justify="between">
                <Text>Exercises:</Text>
                <Text weight="bold">
                  {workoutSession.exerciseGroups.length}
                </Text>
              </Flex>

              <Flex justify="between">
                <Text>Sets Completed:</Text>
                <Text weight="bold">
                  {completedSets} / {totalSets}
                </Text>
              </Flex>

              <Flex justify="between">
                <Text>Started:</Text>
                <Text weight="bold">
                  {workoutSession.workout.start.toLocaleTimeString()}
                </Text>
              </Flex>
            </Flex>
          </Card>

          {/* Action Buttons */}
          <Flex gap="3" style={{ width: "100%" }}>
            <Button variant="soft" style={{ flexGrow: 1 }} asChild>
              <Link
                to={`/workouts/${workoutSession.workout.id}`}
                onClick={() => onOpenChange(false)}
              >
                View Workout
              </Link>
            </Button>

            <fetcher.Form method="post" style={{ flexGrow: 1 }}>
              <input type="hidden" name="intent" value="complete-workout" />
              <Button
                type="submit"
                style={{ width: "100%" }}
                disabled={fetcher.state !== "idle"}
              >
                {fetcher.state === "submitting"
                  ? "Completing..."
                  : "Finish & Go to Dashboard"}
              </Button>
            </fetcher.Form>
          </Flex>

          <Button variant="ghost" size="2" onClick={() => onOpenChange(false)}>
            Continue Workout
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
