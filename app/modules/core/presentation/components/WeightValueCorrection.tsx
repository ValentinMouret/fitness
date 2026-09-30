import { Button, Callout, Dialog, Flex, Text } from "@radix-ui/themes";
import { useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";
import { NumberInput } from "~/components/NumberInput";

export function WeightValueCorrection({
  value,
  timestamp,
  unit,
}: {
  readonly value: number;
  readonly timestamp: string;
  readonly unit: string;
}) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const fetcher = useFetcher<{
    readonly success?: boolean;
    readonly error?: string;
  }>();
  useEffect(() => {
    if (fetcher.data?.success) setOpen(false);
  }, [fetcher.data]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button type="button" variant="ghost" size="1">
          Correct value
        </Button>
      </Dialog.Trigger>
      <Dialog.Content size="2">
        <Dialog.Title>Correct weight</Dialog.Title>
        <Dialog.Description>
          Recorded {new Date(timestamp).toLocaleString()}. The recorded time
          stays the same.
        </Dialog.Description>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="add-measure" />
          <input type="hidden" name="date" value={timestamp} />
          <Text as="label" htmlFor={inputId} size="2">
            Weight ({unit})
          </Text>
          <NumberInput
            id={inputId}
            name="value"
            min={0}
            required
            defaultValue={String(value)}
            aria-label="Corrected weight"
          />
          {fetcher.data?.error && (
            <Callout.Root color="red" mt="3">
              <Callout.Text>{fetcher.data.error}</Callout.Text>
            </Callout.Root>
          )}
          <Flex justify="end" gap="3" mt="4">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" loading={fetcher.state !== "idle"}>
              Save correction
            </Button>
          </Flex>
        </fetcher.Form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
