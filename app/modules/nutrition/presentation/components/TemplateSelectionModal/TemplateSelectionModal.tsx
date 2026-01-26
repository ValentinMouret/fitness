import { Cross2Icon } from "@radix-ui/react-icons";
import { Box, Card, Dialog, Flex, IconButton, Text } from "@radix-ui/themes";
import type { TemplateSelectionViewModel } from "../../view-models/template-selection.view-model";

interface TemplateSelectionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly viewModel: TemplateSelectionViewModel | null;
  readonly onApply: (templateId: string) => void;
}

export function TemplateSelectionModal({
  isOpen,
  onClose,
  viewModel,
  onApply,
}: TemplateSelectionModalProps) {
  if (!viewModel) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content size="3">
        <Flex justify="between" align="center" mb="3">
          <Dialog.Title>
            Choose Template for {viewModel.mealDisplayName}
          </Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost">
              <Cross2Icon />
            </IconButton>
          </Dialog.Close>
        </Flex>

        <Flex direction="column" gap="3">
          {!viewModel.hasTemplates ? (
            <Box>
              <Text size="2" color="gray">
                No templates available for{" "}
                {viewModel.mealDisplayName.toLowerCase()}.
              </Text>
              <Text size="2" color="gray" mt="2">
                Create templates in the Meal Builder to use them here.
              </Text>
            </Box>
          ) : (
            <Box style={{ height: "400px", overflow: "auto" }}>
              <Flex direction="column" gap="2">
                {viewModel.templates.map((template) => (
                  <Card key={template.id} size="1" asChild>
                    <button
                      type="button"
                      onClick={() => onApply(template.id)}
                      style={{ cursor: "pointer", textAlign: "left" }}
                    >
                      <Flex justify="between" align="start" mb="2">
                        <Text weight="medium" size="3">
                          {template.name}
                        </Text>
                        <Text size="1" color="gray">
                          Used {template.usageCount} times
                        </Text>
                      </Flex>

                      <Text size="2" color="gray" mb="2">
                        {template.nutrition.calories} kcal •{" "}
                        {template.nutrition.protein}g protein •{" "}
                        {template.nutrition.carbs}g carbs •{" "}
                        {template.nutrition.fat}g fat
                      </Text>

                      {template.notes && (
                        <Text
                          size="1"
                          color="gray"
                          style={{ fontStyle: "italic" }}
                        >
                          {template.notes}
                        </Text>
                      )}
                    </button>
                  </Card>
                ))}
              </Flex>
            </Box>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
