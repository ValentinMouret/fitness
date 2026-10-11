import {
  AlertDialog,
  Box,
  Button,
  Card,
  Flex,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import "./DeleteConfirmationDialog.css";

interface DeleteConfirmationDialogProps {
  readonly stop: Date;
  readonly exerciseCount: number;
  readonly completedSets: number;
  readonly totalSets: number;
  /** The route whose action deletes the workout. */
  readonly actionPath: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DeleteConfirmationDialog({
  stop,
  exerciseCount,
  completedSets,
  totalSets,
  actionPath,
  open,
  onOpenChange,
}: DeleteConfirmationDialogProps) {
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete-workout";
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

  const completionDate = stop.toISOString().split("T")[0];

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content className="delete-workout-dialog">
        <AlertDialog.Title>Delete Workout</AlertDialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <AlertDialog.Description>
            <Text size="3">
              Are you sure you want to delete this completed workout? This
              action cannot be undone.
            </Text>
          </AlertDialog.Description>

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
                  {exerciseCount}
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

          <Flex gap="3" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" disabled={isBusy}>
                Keep Workout
              </Button>
            </AlertDialog.Cancel>

            <Form ref={formRef} method="post" action={actionPath}>
              <input type="hidden" name="intent" value="delete-workout" />
              <Tooltip content="Delete workout (Cmd/Ctrl+Enter)">
                <Box display="inline-block">
                  <Button
                    type="submit"
                    color="red"
                    disabled={isBusy}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                  >
                    {isDeleting ? "Deleting..." : "Delete Workout"}
                  </Button>
                </Box>
              </Tooltip>
            </Form>
          </Flex>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
