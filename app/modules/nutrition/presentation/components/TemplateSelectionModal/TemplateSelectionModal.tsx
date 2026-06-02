import {
  Cross2Icon,
  DotsHorizontalIcon,
  Link2Icon,
  Share1Icon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Card,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import type { TemplateSelectionViewModel } from "../../view-models/template-selection.view-model";
import "./TemplateSelectionModal.css";

interface TemplateSelectionModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly viewModel: TemplateSelectionViewModel | null;
  readonly onApply: (templateId: string) => void;
  readonly onCopyLink: (templateId: string) => void;
  readonly onToggleShare: (templateId: string, makePublic: boolean) => void;
}

export function TemplateSelectionModal({
  isOpen,
  onClose,
  viewModel,
  onApply,
  onCopyLink,
  onToggleShare,
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
            <IconButton variant="ghost" aria-label="Close">
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
            <Box className="template-selection-modal__list">
              <Flex direction="column" gap="2">
                {viewModel.templates.map((template) => (
                  <Card key={template.id} size="1">
                    <Flex align="start" gap="2">
                      <button
                        type="button"
                        onClick={() => onApply(template.id)}
                        className="template-selection-modal__button"
                      >
                        <Flex justify="between" align="center" mb="2" gap="2">
                          <Flex align="center" gap="2">
                            <Text weight="medium" size="3">
                              {template.name}
                            </Text>
                            {template.isPublic && (
                              <Badge color="green" size="1" variant="soft">
                                Shared
                              </Badge>
                            )}
                          </Flex>
                          <Text size="1" color="gray">
                            Used {template.usageCount} times
                          </Text>
                        </Flex>

                        <Text size="2" color="gray">
                          {template.nutrition.calories} kcal •{" "}
                          {template.nutrition.protein}g protein •{" "}
                          {template.nutrition.carbs}g carbs •{" "}
                          {template.nutrition.fat}g fat
                        </Text>

                        {template.notes && (
                          <Text
                            size="1"
                            color="gray"
                            className="template-selection-modal__notes"
                            mt="2"
                          >
                            {template.notes}
                          </Text>
                        )}
                      </button>

                      <DropdownMenu.Root>
                        <Tooltip content="Share options">
                          <DropdownMenu.Trigger>
                            <IconButton
                              variant="ghost"
                              color="gray"
                              aria-label={`Share options for ${template.name}`}
                            >
                              <DotsHorizontalIcon />
                            </IconButton>
                          </DropdownMenu.Trigger>
                        </Tooltip>
                        <DropdownMenu.Content>
                          {template.isPublic ? (
                            <>
                              <DropdownMenu.Item
                                onClick={() => onCopyLink(template.id)}
                              >
                                <Link2Icon /> Copy link
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                color="red"
                                onClick={() =>
                                  onToggleShare(template.id, false)
                                }
                              >
                                Stop sharing
                              </DropdownMenu.Item>
                            </>
                          ) : (
                            <DropdownMenu.Item
                              onClick={() => onToggleShare(template.id, true)}
                            >
                              <Share1Icon /> Publish &amp; copy link
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Flex>
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
