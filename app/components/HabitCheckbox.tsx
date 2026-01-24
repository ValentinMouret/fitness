import { Flex, Button, Text, Badge } from "@radix-ui/themes";
import { CheckIcon } from "@radix-ui/react-icons";

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
  habitDescription,
  isCompleted,
  isSubmitting = false,
  intent = "toggle-habit",
  streak = 0,
}: HabitCheckboxProps) {
  const getStreakColor = (
    streak: number,
  ): "blue" | "red" | "orange" | "gray" => {
    if (streak >= 90) return "blue";
    if (streak >= 30) return "red";
    if (streak >= 7) return "orange";
    return "gray";
  };

  return (
    <Flex
      align="center"
      gap="3"
      p="3"
      style={{
        borderRadius: "var(--radius-3)",
        border: "1px solid var(--gray-6)",
        backgroundColor: "var(--color-surface)",
      }}
    >
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

      <Flex direction="column" flexGrow="1">
        <Text
          size="3"
          weight="medium"
          style={{
            textDecoration: isCompleted ? "line-through" : "none",
            color: isCompleted ? "var(--gray-9)" : "var(--gray-12)",
          }}
        >
          {habitName}
        </Text>
        {habitDescription && (
          <Text size="2" color="gray">
            {habitDescription}
          </Text>
        )}
      </Flex>

      {streak > 0 && (
        <Badge color={getStreakColor(streak)} variant="soft">
          🔥 {streak} {streak === 1 ? "day" : "days"}
        </Badge>
      )}
    </Flex>
  );
}
