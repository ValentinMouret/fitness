import {
  CheckIcon,
  CounterClockwiseClockIcon,
  Cross2Icon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useEffect, useId, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { NumberInput } from "./NumberInput";
import "./QuickActionSheet.css";

interface Habit {
  readonly id: string;
  readonly name: string;
  readonly identityPhrase: string;
  readonly isCompleted: boolean;
  readonly streak: number;
}

interface QuickActionsData {
  readonly weightLogged: boolean;
  readonly weightUnit?: string;
  readonly lastWeight?: number;
  readonly habits: readonly Habit[];
}

interface QuickActionSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function HabitActionButton({ habit }: { readonly habit: Habit }) {
  const habitFetcher = useFetcher();

  const isOptimisticCompleted =
    habitFetcher.formData?.get("intent") === "toggle-habit"
      ? habitFetcher.formData?.get("completed") === "false"
      : habit.isCompleted;

  const isToggling = habitFetcher.state !== "idle";

  const handleToggleHabit = () => {
    habitFetcher.submit(
      {
        intent: "toggle-habit",
        habitId: habit.id,
        completed: String(habit.isCompleted),
      },
      { method: "post", action: "/dashboard" },
    );
  };

  const ariaLabel = [
    isOptimisticCompleted ? "Unmark" : "Mark",
    `'${habit.name}'`,
    habit.identityPhrase ? `('${habit.identityPhrase}')` : "",
    "as completed",
    habit.streak > 0 ? `(${habit.streak} day streak)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Button
      variant={isOptimisticCompleted ? "solid" : "outline"}
      color={isOptimisticCompleted ? "tomato" : "gray"}
      onClick={handleToggleHabit}
      loading={isToggling}
      className="quick-action-sheet__habit-button"
      aria-label={ariaLabel}
    >
      <Flex
        align="center"
        gap="2"
        className="quick-action-sheet__habit-content"
      >
        {isOptimisticCompleted && (
          <CheckIcon className="quick-action-sheet__habit-icon--pop" />
        )}
        <Flex direction="column" align="start" gap="0">
          <Text
            className={
              isOptimisticCompleted
                ? "quick-action-sheet__habit-name quick-action-sheet__habit-name--completed"
                : "quick-action-sheet__habit-name"
            }
          >
            {habit.name}
          </Text>
          {habit.identityPhrase && (
            <Text
              size="1"
              color="gray"
              className={
                isOptimisticCompleted
                  ? "quick-action-sheet__habit-identity quick-action-sheet__habit-identity--completed"
                  : "quick-action-sheet__habit-identity"
              }
            >
              {habit.identityPhrase}
            </Text>
          )}
        </Flex>
        {habit.streak > 0 && (
          <Text
            size="1"
            color="gray"
            className="quick-action-sheet__habit-streak"
          >
            <span role="img" aria-label="streak">
              🔥
            </span>{" "}
            {habit.streak}
          </Text>
        )}
      </Flex>
    </Button>
  );
}

export function QuickActionSheet({
  open,
  onOpenChange,
}: QuickActionSheetProps) {
  const navigate = useNavigate();
  const weightInputId = useId();
  const dataFetcher = useFetcher<QuickActionsData>();
  const weightFetcher = useFetcher();
  const [weightValue, setWeightValue] = useState("");

  useEffect(() => {
    if (open && dataFetcher.state === "idle" && !dataFetcher.data) {
      dataFetcher.load("/api/quick-actions");
    }
  }, [open, dataFetcher]);

  useEffect(() => {
    if (dataFetcher.data?.lastWeight && !weightValue) {
      setWeightValue(dataFetcher.data.lastWeight.toString());
    }
  }, [dataFetcher.data?.lastWeight, weightValue]);

  const handleStartWorkout = () => {
    onOpenChange(false);
    navigate("/workouts/create");
  };

  const handleLogMeal = () => {
    onOpenChange(false);
    navigate("/nutrition");
  };

  const isLoading = dataFetcher.state === "loading";
  const data = dataFetcher.data;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="quick-action-sheet">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>
            <Heading size="5">Quick Actions</Heading>
          </Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost" size="2" aria-label="Close">
              <Cross2Icon />
            </IconButton>
          </Dialog.Close>
        </Flex>

        {isLoading ? (
          <Flex justify="center" py="6">
            <Spinner size="3" />
          </Flex>
        ) : (
          <>
            {data?.habits && data.habits.length > 0 && (
              <Box mb="4">
                <Text size="2" color="gray" mb="2" weight="medium">
                  Today's Habits
                </Text>
                <Flex direction="column" gap="2">
                  {data.habits.map((habit) => (
                    <HabitActionButton key={habit.id} habit={habit} />
                  ))}
                </Flex>
              </Box>
            )}

            {!data?.weightLogged && (
              <Box mb="4">
                <Text
                  as="label"
                  htmlFor={weightInputId}
                  size="2"
                  color="gray"
                  mb="2"
                  weight="medium"
                  style={{ display: "block" }}
                >
                  Log Weight
                </Text>
                <weightFetcher.Form
                  method="post"
                  action="/dashboard"
                  onSubmit={() => onOpenChange(false)}
                >
                  <Flex gap="2" align="end">
                    <Box flexGrow="1">
                      <NumberInput
                        id={weightInputId}
                        name="weight"
                        min={0}
                        placeholder={
                          data?.lastWeight
                            ? `Last: ${data.lastWeight}`
                            : "Enter weight"
                        }
                        value={weightValue}
                        onChange={(e) => setWeightValue(e.target.value)}
                      >
                        {data?.weightUnit && (
                          <TextField.Slot pr="3">
                            <Text size="1" color="gray">
                              {data.weightUnit}
                            </Text>
                          </TextField.Slot>
                        )}
                      </NumberInput>
                    </Box>
                    <Button
                      type="submit"
                      loading={weightFetcher.state !== "idle"}
                      disabled={!weightValue && weightFetcher.state === "idle"}
                      aria-label="Log weight"
                    >
                      Log
                    </Button>
                  </Flex>
                </weightFetcher.Form>
              </Box>
            )}

            <Flex direction="column" gap="2">
              <Button size="3" onClick={handleStartWorkout}>
                <CounterClockwiseClockIcon /> Start Workout
              </Button>
              <Button size="3" variant="outline" onClick={handleLogMeal}>
                <ReaderIcon /> Log Meal
              </Button>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
