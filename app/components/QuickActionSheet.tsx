import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
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
  readonly lastWeight?: number;
  readonly habits: readonly Habit[];
}

interface QuickActionSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function QuickActionSheet({
  open,
  onOpenChange,
}: QuickActionSheetProps) {
  const navigate = useNavigate();
  const dataFetcher = useFetcher<QuickActionsData>();
  const habitFetcher = useFetcher();
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

  const handleToggleHabit = (habitId: string, currentlyCompleted: boolean) => {
    habitFetcher.submit(
      {
        intent: "toggle-habit",
        habitId,
        completed: String(currentlyCompleted),
      },
      { method: "post", action: "/dashboard" },
    );
  };

  const handleLogWeight = () => {
    if (!weightValue) return;
    weightFetcher.submit(
      { weight: weightValue },
      { method: "post", action: "/dashboard" },
    );
    onOpenChange(false);
  };

  const handleStartWorkout = () => {
    onOpenChange(false);
    navigate("/workouts/create");
  };

  const handleLogMeal = () => {
    onOpenChange(false);
    navigate("/nutrition/meals");
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
                  {data.habits.map((habit) => {
                    const isOptimisticCompleted =
                      habitFetcher.formData?.get("habitId") === habit.id
                        ? habitFetcher.formData?.get("completed") !== "true"
                        : habit.isCompleted;

                    const isToggling =
                      habitFetcher.state !== "idle" &&
                      habitFetcher.formData?.get("habitId") === habit.id;

                    return (
                      <Button
                        key={habit.id}
                        variant={isOptimisticCompleted ? "solid" : "outline"}
                        color={isOptimisticCompleted ? "tomato" : "gray"}
                        onClick={() =>
                          handleToggleHabit(habit.id, isOptimisticCompleted)
                        }
                        loading={isToggling}
                        className="quick-action-sheet__habit-button"
                        aria-label={`${isOptimisticCompleted ? "Unmark" : "Mark"} '${habit.name}' ${habit.identityPhrase ? `('${habit.identityPhrase}') ` : ""}as completed`}
                      >
                        <Flex
                          align="center"
                          gap="2"
                          className="quick-action-sheet__habit-content"
                        >
                          {isOptimisticCompleted && <CheckIcon />}
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
                                    ? "quick-action-sheet__habit-name--completed"
                                    : ""
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
                              🔥 {habit.streak}
                            </Text>
                          )}
                        </Flex>
                      </Button>
                    );
                  })}
                </Flex>
              </Box>
            )}

            {!data?.weightLogged && (
              <Box mb="4">
                <Text size="2" color="gray" mb="2" weight="medium">
                  Log Weight
                </Text>
                <Flex gap="2" align="end">
                  <Box flexGrow="1">
                    <NumberInput
                      name="weight"
                      min={0}
                      placeholder="Enter weight"
                      value={weightValue}
                      onChange={(e) => setWeightValue(e.target.value)}
                    />
                  </Box>
                  <Button
                    onClick={handleLogWeight}
                    loading={weightFetcher.state !== "idle"}
                    disabled={!weightValue || weightFetcher.state !== "idle"}
                  >
                    Log
                  </Button>
                </Flex>
              </Box>
            )}

            <Flex direction="column" gap="2">
              <Button size="3" onClick={handleStartWorkout}>
                🏋️ Start Workout
              </Button>
              <Button size="3" variant="outline" onClick={handleLogMeal}>
                🍽️ Log Meal
              </Button>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
