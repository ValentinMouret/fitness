import {
  Box,
  Button,
  Dialog,
  Flex,
  Kbd,
  ScrollArea,
  Text,
} from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import { Form, useNavigation, useSubmit } from "react-router";
import type { WorkoutTemplateCardViewModel } from "../../view-models/workout-template-card.view-model";
import "./StartWorkoutDialog.css";

interface StartWorkoutDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templates: ReadonlyArray<WorkoutTemplateCardViewModel>;
}

export function StartWorkoutDialog({
  open,
  onOpenChange,
  templates,
}: StartWorkoutDialogProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const isBusy = navigation.state !== "idle";
  const freshFormRef = useRef<HTMLFormElement>(null);
  const templateFormRefs = useRef<(HTMLFormElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        if (freshFormRef.current) {
          submit(freshFormRef.current);
        }
      } else if (key >= "1" && key <= "9") {
        const index = Number.parseInt(key, 10) - 1;
        const form = templateFormRefs.current[index];
        if (form) {
          e.preventDefault();
          submit(form);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submit]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="start-workout-dialog">
        <Dialog.Title size="5" mb="4">
          Start Workout
        </Dialog.Title>

        <Form ref={freshFormRef} method="post" action="/workouts/create">
          <button
            type="submit"
            disabled={isBusy}
            className={`start-workout-dialog__option ${isBusy ? "start-workout-dialog__option--disabled" : ""}`}
            aria-label="Start Fresh (F)"
            aria-keyshortcuts="f"
          >
            <Flex justify="between" align="center">
              <Text size="3" weight="medium">
                Start Fresh
              </Text>
              <Box display={{ initial: "none", md: "inline-block" }}>
                <Kbd size="1">F</Kbd>
              </Box>
            </Flex>
            <Text size="2" color="gray" as="p" mt="1">
              Begin with an empty workout
            </Text>
          </button>
        </Form>

        {templates.length > 0 && (
          <Box mt="4">
            <Text
              as="div"
              size="1"
              weight="bold"
              mb="3"
              className="start-workout-dialog__section-label"
            >
              Templates
            </Text>

            <ScrollArea className="start-workout-dialog__templates">
              <Flex direction="column" gap="2">
                {templates.map((template, index) => (
                  <Form
                    key={template.id}
                    ref={(el) => {
                      templateFormRefs.current[index] = el;
                    }}
                    method="post"
                    action="/workouts/create"
                  >
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className={`start-workout-dialog__option ${isBusy ? "start-workout-dialog__option--disabled" : ""}`}
                      aria-label={`${template.name}${index < 9 ? ` (${index + 1})` : ""}`}
                      aria-keyshortcuts={
                        index < 9 ? String(index + 1) : undefined
                      }
                    >
                      <Flex justify="between" align="center">
                        <Flex align="center" gap="2">
                          <Text size="3" weight="medium">
                            {template.name}
                          </Text>
                          <Text size="1" color="gray">
                            {template.usageCount > 0
                              ? `${template.usageCount}x`
                              : ""}
                          </Text>
                        </Flex>
                        {index < 9 && (
                          <Box
                            display={{ initial: "none", md: "inline-block" }}
                          >
                            <Kbd size="1">{index + 1}</Kbd>
                          </Box>
                        )}
                      </Flex>
                      <Text size="2" color="gray" as="p" mt="1">
                        {template.exerciseCount} exercises
                        {template.usageCount > 0 &&
                          ` · ${template.lastUsedLabel}`}
                      </Text>
                    </button>
                  </Form>
                ))}
              </Flex>
            </ScrollArea>
          </Box>
        )}

        <Flex mt="4" justify="end">
          <Button variant="soft" size="2" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
