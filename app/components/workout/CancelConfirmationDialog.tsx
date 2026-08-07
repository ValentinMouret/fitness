import {
  AlertDialog,
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import { useLiveDuration } from "./useLiveDuration";
import "./CancelConfirmationDialog.css";

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

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!isBusy) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isBusy]);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content className="cancel-workout-dialog">
        <Heading size="4" mb="2">
          Cancel Workout
        </Heading>

        <Text size="2" color="gray">
          This will permanently delete all workout data.
        </Text>

        <Box py="4" mt="3" className="cancel-workout-dialog__section">
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

          <Form ref={formRef} method="post">
            <input type="hidden" name="intent" value="cancel-workout" />
            <Tooltip content="Cancel workout (Cmd/Ctrl+Enter)">
              <Box display="inline-block">
                <Button
                  type="submit"
                  size="2"
                  color="red"
                  disabled={isBusy}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  {isCancelling ? "Cancelling..." : "Cancel"}
                </Button>
              </Box>
            </Tooltip>
          </Form>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
