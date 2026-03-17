import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Button,
  Card,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import "./HabitWeekActionsMenu.css";

interface HabitWeekActionsMenuProps {
  readonly habitId: string;
  readonly name: string;
  readonly identityPhrase: string;
  readonly timeOfDay: string;
  readonly color: string;
}

export function HabitWeekActionsMenu({
  habitId,
  name,
  identityPhrase,
  timeOfDay,
  color,
}: HabitWeekActionsMenuProps) {
  const navigate = useNavigate();
  const fetcher = useFetcher<{
    readonly success?: boolean;
    readonly error?: string;
  }>();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isDeleting =
    fetcher.state === "submitting" &&
    fetcher.formData?.get("intent") === "delete-habit";
  const error =
    fetcher.state === "idle" && typeof fetcher.data?.error === "string"
      ? fetcher.data.error
      : null;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success === true) {
      setDeleteOpen(false);
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <>
      <div className="habit-week-actions-menu">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton
              variant="ghost"
              size="1"
              aria-label={`Actions for ${name}`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="7.5" cy="2.5" r="1.25" fill="currentColor" />
                <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" />
                <circle cx="7.5" cy="12.5" r="1.25" fill="currentColor" />
              </svg>
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              onSelect={() => navigate(`/habits/${habitId}/edit`)}
            >
              <Pencil1Icon /> Edit
            </DropdownMenu.Item>
            <DropdownMenu.Item color="red" onSelect={() => setDeleteOpen(true)}>
              <TrashIcon /> Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content className="habit-week-actions-menu__dialog">
          <AlertDialog.Title>Delete habit</AlertDialog.Title>

          <Flex direction="column" gap="4" mt="4">
            <AlertDialog.Description>
              <Text size="3">
                Delete {name}? It will disappear from your weekly and daily
                habits views.
              </Text>
            </AlertDialog.Description>

            <Card className="habit-week-actions-menu__preview">
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                  <span
                    className="habit-week-actions-menu__swatch"
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
                <Text size="2" className="habit-week-actions-menu__meta">
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
    </>
  );
}
