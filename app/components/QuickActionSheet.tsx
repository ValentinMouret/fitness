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
  ScrollArea,
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

function QuickActionHabitItem({
  habit,
  index,
  onToggleReady,
}: {
  readonly habit: Habit;
  readonly index: number;
  readonly onToggleReady: (index: number, toggle: () => void) => void;
}) {
  const fetcher = useFetcher();

  const isOptimisticCompleted =
    fetcher.formData?.get("habitId") === habit.id
      ? fetcher.formData?.get("completed") !== "true"
      : habit.isCompleted;

  const isToggling = fetcher.state !== "idle";

  const handleToggle = useCallback(() => {
    if (isToggling) return;
    fetcher.submit(
      {
        intent: "toggle-habit",
        habitId: habit.id,
        completed: String(isOptimisticCompleted),
      },
      { method: "post", action: "/dashboard" },
    );
  }, [fetcher, habit.id, isOptimisticCompleted, isToggling]);

  useEffect(() => {
    onToggleReady(index, handleToggle);
    return () => onToggleReady(index, () => {});
  }, [index, handleToggle, onToggleReady]);

  const shortcutHint = index < 9 ? String(index + 1) : undefined;

  const ariaLabel = [
    isOptimisticCompleted ? "Unmark" : "Mark",
    `'${habit.name}'`,
    habit.identityPhrase ? `('${habit.identityPhrase}')` : "",
    "as completed",
    habit.streak > 0 ? `(${habit.streak} day streak)` : "",
    shortcutHint ? `(${shortcutHint})` : "",
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
        aria-keyshortcuts={shortcutHint}
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
          {shortcutHint && (
            <Box ml="2" display={{ initial: "none", md: "inline-block" }}>
              <Kbd size="1">{shortcutHint}</Kbd>
            </Box>
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
  const habitToggles = useRef<(() => void)[]>([]);
  const [weightValue, setWeightValue] = useState("");
  const [hasPrefilled, setHasPrefilled] = useState(false);

  const handleToggleReady = useCallback((index: number, toggle: () => void) => {
    habitToggles.current[index] = toggle;
  }, []);

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
      } else if (key >= "1" && key <= "9") {
        const index = Number.parseInt(key, 10) - 1;
        const toggle = habitToggles.current[index];
        if (toggle) {
          e.preventDefault();
          toggle();
        }
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
            <Tooltip content="Close (Esc)">
              <IconButton variant="ghost" size="2" aria-label="Close (Esc)">
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
                <ScrollArea
                  type="auto"
                  scrollbars="vertical"
                  className="quick-action-sheet__habits-scroll"
                >
                  <Flex direction="column" gap="2" pr="3">
                    {data.habits.map((habit, index) => (
                      <QuickActionHabitItem
                        key={habit.id}
                        habit={habit}
                        index={index}
                        onToggleReady={handleToggleReady}
                      />
                    ))}
                  </Flex>
                </ScrollArea>
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
                      <Tooltip content="Log weight (Enter)">
                        <Button
                          type="submit"
                          loading={weightFetcher.state !== "idle"}
                          disabled={
                            !weightValue && weightFetcher.state === "idle"
                          }
                          aria-label="Log weight (Enter)"
                        >
                          Log
                        </Button>
                      </Tooltip>
                    </Flex>
                  </weightFetcher.Form>
                </Box>
              </SuccessPulse>
            )}

            <Flex direction="column" gap="2">
              <Tooltip content="Start Workout (S)">
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
              </Tooltip>
              <Tooltip content="Log Meal (M)">
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
              </Tooltip>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
