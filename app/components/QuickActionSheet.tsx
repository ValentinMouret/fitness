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
  Kbd,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { SuccessPulse } from "./Celebration";
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

function QuickActionHabitItem({ habit }: { readonly habit: Habit }) {
  const fetcher = useFetcher();

  const isOptimisticCompleted =
    fetcher.formData?.get("habitId") === habit.id
      ? fetcher.formData?.get("completed") !== "true"
      : habit.isCompleted;

  const isToggling = fetcher.state !== "idle";

  const handleToggle = () => {
    fetcher.submit(
      {
        intent: "toggle-habit",
        habitId: habit.id,
        completed: String(isOptimisticCompleted),
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
    <SuccessPulse trigger={isToggling}>
      <Button
        variant={isOptimisticCompleted ? "solid" : "outline"}
        color={isOptimisticCompleted ? "tomato" : "gray"}
        onClick={handleToggle}
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
    </SuccessPulse>
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
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [weightValue, setWeightValue] = useState("");
  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasPrefilled(false);
      setWeightValue("");
    }
  }, [open]);

  useEffect(() => {
    if (open && dataFetcher.state === "idle" && !dataFetcher.data) {
      dataFetcher.load("/api/quick-actions");
    }
  }, [open, dataFetcher]);

  useEffect(() => {
    if (dataFetcher.data?.lastWeight && !hasPrefilled) {
      setWeightValue(dataFetcher.data.lastWeight.toString());
      setHasPrefilled(true);
    }
  }, [dataFetcher.data?.lastWeight, hasPrefilled]);

  const [isSuccessfullySubmitted, setIsSuccessfullySubmitted] = useState(false);

  useEffect(() => {
    if (weightFetcher.state === "submitting") {
      setIsSuccessfullySubmitted(true);
    } else if (weightFetcher.state === "idle" && isSuccessfullySubmitted) {
      const timer = setTimeout(() => {
        onOpenChange(false);
        setIsSuccessfullySubmitted(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [weightFetcher.state, isSuccessfullySubmitted, onOpenChange]);

  const handleStartWorkout = useCallback(() => {
    onOpenChange(false);
    navigate("/workouts/create");
  }, [onOpenChange, navigate]);

  const handleLogMeal = useCallback(() => {
    onOpenChange(false);
    navigate("/nutrition");
  }, [onOpenChange, navigate]);

  const isLoading = dataFetcher.state === "loading";
  const data = dataFetcher.data;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        handleStartWorkout();
      } else if (key === "m") {
        e.preventDefault();
        handleLogMeal();
      } else if (key === "w" && weightInputRef.current) {
        e.preventDefault();
        weightInputRef.current.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleStartWorkout, handleLogMeal]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="quick-action-sheet">
        <Flex justify="between" align="center" mb="4">
          <Dialog.Title>
            <Heading size="5">Quick Actions</Heading>
          </Dialog.Title>
          <Dialog.Close>
            <Tooltip content="Close">
              <IconButton variant="ghost" size="2" aria-label="Close">
                <Cross2Icon />
              </IconButton>
            </Tooltip>
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
                    <QuickActionHabitItem key={habit.id} habit={habit} />
                  ))}
                </Flex>
              </Box>
            )}

            {!data?.weightLogged && (
              <SuccessPulse trigger={weightFetcher.state !== "idle"}>
                <Box mb="4">
                  <Flex align="center" justify="between" mb="2">
                    <Text
                      as="label"
                      htmlFor={weightInputId}
                      size="2"
                      color="gray"
                      weight="medium"
                    >
                      Log Weight
                    </Text>
                    <Box display={{ initial: "none", md: "inline-block" }}>
                      <Kbd size="1">W</Kbd>
                    </Box>
                  </Flex>
                  <weightFetcher.Form method="post" action="/dashboard">
                    <Flex gap="2" align="end">
                      <Box flexGrow="1">
                        <NumberInput
                          ref={weightInputRef}
                          id={weightInputId}
                          name="weight"
                          min={0}
                          aria-label="Weight"
                          aria-keyshortcuts="w"
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
                        disabled={
                          !weightValue && weightFetcher.state === "idle"
                        }
                        aria-label="Log weight"
                      >
                        Log
                      </Button>
                    </Flex>
                  </weightFetcher.Form>
                </Box>
              </SuccessPulse>
            )}

            <Flex direction="column" gap="2">
              <Button
                size="3"
                onClick={handleStartWorkout}
                aria-keyshortcuts="s"
                aria-label="Start Workout (S)"
              >
                <CounterClockwiseClockIcon /> Start Workout
                <Box
                  ml="auto"
                  display={{ initial: "none", md: "inline-block" }}
                >
                  <Kbd size="1">S</Kbd>
                </Box>
              </Button>
              <Button
                size="3"
                variant="outline"
                onClick={handleLogMeal}
                aria-keyshortcuts="m"
                aria-label="Log Meal (M)"
              >
                <ReaderIcon /> Log Meal
                <Box
                  ml="auto"
                  display={{ initial: "none", md: "inline-block" }}
                >
                  <Kbd size="1">M</Kbd>
                </Box>
              </Button>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
