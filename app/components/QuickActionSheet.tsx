import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  Text,
  IconButton,
  Spinner,
} from "@radix-ui/themes";
import { Cross2Icon, CheckIcon } from "@radix-ui/react-icons";
import { useFetcher, useNavigate } from "react-router";
import { NumberInput } from "./NumberInput";

interface Habit {
  readonly id: string;
  readonly name: string;
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
      <Dialog.Content
        className="quick-action-sheet"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          top: "auto",
          margin: 0,
          borderRadius: "16px 16px 0 0",
          maxHeight: "80vh",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        }}
      >
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>
            <Heading size="5">Quick Actions</Heading>
          </Dialog.Title>
          <Dialog.Close>
            <IconButton variant="ghost" size="2">
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

                    return (
                      <Button
                        key={habit.id}
                        variant={isOptimisticCompleted ? "solid" : "outline"}
                        color={isOptimisticCompleted ? "tomato" : "gray"}
                        onClick={() =>
                          handleToggleHabit(habit.id, isOptimisticCompleted)
                        }
                        disabled={habitFetcher.state !== "idle"}
                        style={{ justifyContent: "flex-start" }}
                      >
                        <Flex align="center" gap="2" style={{ width: "100%" }}>
                          {isOptimisticCompleted && <CheckIcon />}
                          <Text
                            style={{
                              textDecoration: isOptimisticCompleted
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {habit.name}
                          </Text>
                          {habit.streak > 0 && (
                            <Text
                              size="1"
                              color="gray"
                              style={{ marginLeft: "auto" }}
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
