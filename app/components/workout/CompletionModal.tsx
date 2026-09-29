import { Box, Button, Dialog, Flex, Text, Tooltip } from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import { useLiveDuration } from "./useLiveDuration";
import "./CompletionModal.css";

interface WorkoutSummarySet {
  readonly isCompleted: boolean;
}

interface WorkoutSummaryGroup {
  readonly sets: ReadonlyArray<WorkoutSummarySet>;
}

interface CompletionWorkoutSession {
  readonly workout: {
    readonly start: Date;
    readonly stop?: Date;
    readonly name: string;
  };
  readonly exerciseGroups: ReadonlyArray<WorkoutSummaryGroup>;
}

interface CompletionModalProps {
  readonly workoutSession: CompletionWorkoutSession;
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
      <Dialog.Content className="completion-modal">
        <Form ref={formRef} method="post">
          <input type="hidden" name="intent" value="complete-workout" />
          <Dialog.Title size="4" mb="4">
            Complete Workout
          </Dialog.Title>

          <Box py="4" className="completion-modal__section">
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
              type="button"
              variant="soft"
              size="2"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
            >
              Continue
            </Button>
            <Tooltip content="Finish workout (Cmd/Ctrl+Enter)">
              <Box display="inline-block">
                <Button
                  type="submit"
                  size="2"
                  disabled={isBusy}
                  loading={isCompleting}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  Finish
                </Button>
              </Box>
            </Tooltip>
          </Flex>
        </Form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
