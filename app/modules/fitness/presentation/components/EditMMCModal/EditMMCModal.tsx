import {
  Box,
  Button,
  Dialog,
  Flex,
  Text,
  TextArea,
  Tooltip,
} from "@radix-ui/themes";
import { useCallback, useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";

interface EditMMCModalProps {
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly mmcInstructions?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function EditMMCModal({
  exerciseId,
  exerciseName,
  mmcInstructions,
  open,
  onOpenChange,
}: EditMMCModalProps) {
  const fetcher = useFetcher();
  const textareaId = useId();
  const [value, setValue] = useState(mmcInstructions ?? "");

  const isBusy = fetcher.state !== "idle";

  useEffect(() => {
    if (open) {
      setValue(mmcInstructions ?? "");
    }
  }, [open, mmcInstructions]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && "success" in fetcher.data) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        intent: "update-exercise-mmc",
        exerciseId,
        mmcInstructions: value,
      },
      { method: "post" },
    );
  }, [fetcher, exerciseId, value]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!isBusy) {
        handleSave();
      }
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Mind-Muscle Connection</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {exerciseName}
        </Dialog.Description>

        <Flex direction="column" gap="1" mt="4">
          <Text as="label" htmlFor={textareaId} size="2" weight="medium">
            Focus Cues & Instructions
          </Text>
          <TextArea
            id={textareaId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Focus cues to engage target muscles, e.g. 'Squeeze at the top', 'Feel the stretch at the bottom'"
            rows={4}
            disabled={isBusy}
          />
        </Flex>

        <Flex gap="2" justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray" disabled={isBusy}>
              Cancel
            </Button>
          </Dialog.Close>
          <Tooltip content="Save (Cmd/Ctrl+Enter)">
            <Box display="inline-block">
              <Button
                onClick={handleSave}
                loading={isBusy}
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                Save
              </Button>
            </Box>
          </Tooltip>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
