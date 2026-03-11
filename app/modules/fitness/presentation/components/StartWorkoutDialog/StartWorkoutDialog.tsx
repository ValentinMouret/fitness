import { Box, Button, Dialog, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { Form, useNavigation } from "react-router";
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
  const isBusy = navigation.state !== "idle";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="start-workout-dialog">
        <Dialog.Title size="5" mb="4">
          Start Workout
        </Dialog.Title>

        <Form method="post" action="/workouts/create">
          <button
            type="submit"
            disabled={isBusy}
            className={`start-workout-dialog__option ${isBusy ? "start-workout-dialog__option--disabled" : ""}`}
          >
            <Text size="3" weight="medium" as="p">
              Start Fresh
            </Text>
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
                {templates.map((template) => (
                  <Form
                    key={template.id}
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
                    >
                      <Flex justify="between" align="center">
                        <Text size="3" weight="medium">
                          {template.name}
                        </Text>
                        <Text size="1" color="gray">
                          {template.usageCount > 0
                            ? `${template.usageCount}x`
                            : ""}
                        </Text>
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
