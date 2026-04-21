import { CheckIcon } from "@radix-ui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useFetcher } from "react-router";
import "./HabitCheckbox.css";

interface HabitCheckboxProps {
  readonly habitId: string;
  readonly habitName: string;
  readonly habitDescription?: string | null;
  readonly isCompleted: boolean;
  readonly intent?: string;
  readonly streak?: number;
}

export default function HabitCheckbox({
  habitId,
  habitName,
  habitDescription,
  isCompleted,
  intent = "toggle-habit",
  streak = 0,
}: HabitCheckboxProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const displayCompleted = fetcher.formData
    ? fetcher.formData.get("completed") === "false"
    : isCompleted;

  const label = `${displayCompleted ? "Unmark" : "Mark"} ${habitName} as completed`;

  return (
    <fetcher.Form method="post">
      <Flex align="center" gap="3" py="3">
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="habitId" value={habitId} />
        <input type="hidden" name="completed" value={String(isCompleted)} />

        <Button
          type="submit"
          variant={displayCompleted ? "solid" : "outline"}
          color={displayCompleted ? "tomato" : "gray"}
          size="2"
          className="habit-checkbox__button"
          loading={isSubmitting}
          aria-label={label}
        >
          {displayCompleted && !isSubmitting && <CheckIcon />}
        </Button>

        <Flex direction="column" flexGrow="1">
          <Text
            size="3"
            weight="medium"
            className={`habit-checkbox__label ${displayCompleted ? "habit-checkbox__label--completed" : ""}`}
          >
            {habitName}
          </Text>
          {habitDescription && (
            <Text
              size="1"
              className={`habit-checkbox__description ${displayCompleted ? "habit-checkbox__description--completed" : ""}`}
            >
              {habitDescription}
            </Text>
          )}
        </Flex>

        {streak > 0 && (
          <Text size="2" className="habit-checkbox__streak">
            {streak}d
          </Text>
        )}
      </Flex>
    </fetcher.Form>
  );
}
