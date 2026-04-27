import { Button, Dialog, Flex, TextArea } from "@radix-ui/themes";
import { useEffect, useState } from "react";
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
  const [value, setValue] = useState(mmcInstructions ?? "");

  const isBusy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && "success" in fetcher.data) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  const handleSave = () => {
    fetcher.submit(
      {
        intent: "update-exercise-mmc",
        exerciseId,
        mmcInstructions: value,
      },
      { method: "post" },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Mind-Muscle Connection</Dialog.Title>
        <Dialog.Description size="2" color="gray">
          {exerciseName}
        </Dialog.Description>

        <Flex direction="column" gap="3" mt="4">
          <TextArea
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
          <Button onClick={handleSave} loading={isBusy}>
            Save
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
