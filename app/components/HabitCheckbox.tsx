import { CheckIcon } from "@radix-ui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";

interface HabitCheckboxProps {
  readonly habitId: string;
  readonly habitName: string;
  readonly habitDescription?: string;
  readonly isCompleted: boolean;
  readonly isSubmitting?: boolean;
  readonly intent?: string;
  readonly streak?: number;
}

export default function HabitCheckbox({
  habitId,
  habitName,
  isCompleted,
  isSubmitting = false,
  intent = "toggle-habit",
  streak = 0,
}: HabitCheckboxProps) {
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
        style={{
          width: "28px",
          height: "28px",
          flexShrink: 0,
          padding: 0,
        }}
        disabled={isSubmitting}
      >
        {isCompleted && <CheckIcon />}
      </Button>

      <Text
        size="3"
        weight="medium"
        style={{
          flex: 1,
          color: isCompleted ? "var(--gray-9)" : "var(--gray-12)",
        }}
      >
        {habitName}
      </Text>

      {streak > 0 && (
        <Text size="2" style={{ color: "var(--brand-text-secondary)" }}>
          {streak}d
        </Text>
      )}
    </Flex>
  );
}
