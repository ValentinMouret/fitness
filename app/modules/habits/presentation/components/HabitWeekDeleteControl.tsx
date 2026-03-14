import { TrashIcon } from "@radix-ui/react-icons";
import { AlertDialog, Button, Card, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import "./HabitWeekDeleteControl.css";

interface HabitWeekDeleteControlProps {
  readonly habitId: string;
  readonly name: string;
  readonly identityPhrase: string;
  readonly timeOfDay: string;
  readonly color: string;
}

export function HabitWeekDeleteControl({
  habitId,
  name,
  identityPhrase,
  timeOfDay,
  color,
}: HabitWeekDeleteControlProps) {
  const fetcher = useFetcher<{
    readonly success?: boolean;
    readonly error?: string;
  }>();
  const [open, setOpen] = useState(false);

  const isDeleting =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "delete-habit";
  const error =
    fetcher.state === "idle" && typeof fetcher.data?.error === "string"
      ? fetcher.data.error
      : null;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success === true) {
      setOpen(false);
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <div className="habit-week-delete-control">
        <button
          type="button"
          className="habit-week-delete-control__trigger"
          aria-label={`Delete ${name}`}
          onClick={() => setOpen(true)}
        >
          <TrashIcon width={14} height={14} />
        </button>
      </div>

      <AlertDialog.Content className="habit-week-delete-control__dialog">
        <AlertDialog.Title>Delete habit</AlertDialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <AlertDialog.Description>
            <Text size="3">
              Delete {name}? It will disappear from your weekly and daily habits
              views.
            </Text>
          </AlertDialog.Description>

          <Card className="habit-week-delete-control__preview">
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2">
                <span
                  className="habit-week-delete-control__swatch"
                  style={{ backgroundColor: color }}
                />
                <Text weight="bold" size="3">
                  {name}
                </Text>
              </Flex>
              {identityPhrase ? (
                <Text size="2" color="gray">
                  {identityPhrase}
                </Text>
              ) : null}
              <Text size="2" className="habit-week-delete-control__meta">
                {timeOfDay || "No time set"}
              </Text>
            </Flex>
          </Card>

          {error ? (
            <Text size="2" color="red">
              {error}
            </Text>
          ) : null}

          <Flex gap="3" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray" disabled={isDeleting}>
                Keep habit
              </Button>
            </AlertDialog.Cancel>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-habit" />
              <input type="hidden" name="habitId" value={habitId} />
              <Button type="submit" color="red" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete habit"}
              </Button>
            </fetcher.Form>
          </Flex>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
