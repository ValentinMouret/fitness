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
  Kbd,
  ScrollArea,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect } from "react";
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
  useEffect(() => {
    if (!isOpen || !viewModel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      const key = e.key;
      if (key >= "1" && key <= "9") {
        const index = Number.parseInt(key, 10) - 1;
        const template = viewModel.templates[index];
        if (template) {
          e.preventDefault();
          onApply(template.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, viewModel, onApply]);

  if (!viewModel) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Content size="3">
        <Flex justify="between" align="center" mb="3">
          <Dialog.Title>
            Choose Template for {viewModel.mealDisplayName}
          </Dialog.Title>
          <Dialog.Close>
            <Tooltip content="Close (Esc)">
              <IconButton variant="ghost" aria-label="Close (Esc)">
                <Cross2Icon />
              </IconButton>
            </Tooltip>
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
            <ScrollArea
              type="auto"
              scrollbars="vertical"
              className="template-selection-modal__list"
            >
              <Flex direction="column" gap="2" pr="3">
                {viewModel.templates.map((template, index) => (
                  <Card key={template.id} size="1">
                    <Flex align="start" gap="2">
                      <button
                        type="button"
                        onClick={() => onApply(template.id)}
                        className="template-selection-modal__button"
                        aria-label={`${template.name}${index < 9 ? ` (${index + 1})` : ""}`}
                        aria-keyshortcuts={
                          index < 9 ? String(index + 1) : undefined
                        }
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
                          <Flex align="center" gap="2">
                            <Text size="1" color="gray">
                              Used {template.usageCount} times
                            </Text>
                            {index < 9 && (
                              <Box
                                display={{
                                  initial: "none",
                                  md: "inline-block",
                                }}
                              >
                                <Kbd size="1">{index + 1}</Kbd>
                              </Box>
                            )}
                          </Flex>
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
            </ScrollArea>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
