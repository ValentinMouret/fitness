import { CheckIcon } from "@radix-ui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";
import "./HabitCheckbox.css";

interface HabitCheckboxProps {
  readonly habitId: string;
  readonly habitName: string;
  readonly habitDescription?: string | null;
  readonly isCompleted: boolean;
  readonly isSubmitting?: boolean;
  readonly intent?: string;
  readonly streak?: number;
}

export default function HabitCheckbox({
  habitId,
  habitName,
  habitDescription,
  isCompleted,
  isSubmitting = false,
  intent = "toggle-habit",
  streak = 0,
}: HabitCheckboxProps) {
  const label = `${isCompleted ? "Unmark" : "Mark"} ${habitName} as completed`;

  return (
    <Flex align="center" gap="3" py="3">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="habitId" value={habitId} />
      <input type="hidden" name="completed" value={String(isCompleted)} />

      <Button
        type="submit"
        variant={isCompleted ? "solid" : "outline"}
        color={isCompleted ? "tomato" : "gray"}
        size="2"
        className="habit-checkbox__button"
        disabled={isSubmitting}
        aria-label={label}
      >
        {isCompleted && <CheckIcon />}
      </Button>

      <Flex direction="column" grow="1">
        <Text
          size="3"
          weight="medium"
          className={`habit-checkbox__label ${isCompleted ? "habit-checkbox__label--completed" : ""}`}
        >
          {habitName}
        </Text>
        {habitDescription && (
          <Text
            size="1"
            className={`habit-checkbox__description ${isCompleted ? "habit-checkbox__description--completed" : ""}`}
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
  );
}
