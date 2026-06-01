import { Box, Button, Flex, Kbd, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher, useFetchers, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { Celebration, SuccessPulse } from "~/components/Celebration";
import HabitCheckbox from "~/components/HabitCheckbox";
import MeasurementChart from "~/components/MeasurementChart";
import { NumberInput } from "~/components/NumberInput";
import { saveDailyNote } from "~/modules/daily-note/infra/daily-note.service.server";
import { DailyNoteCard } from "~/modules/daily-note/presentation/components/DailyNoteCard/DailyNoteCard";
import { DailyNoteModal } from "~/modules/daily-note/presentation/components/DailyNoteModal/DailyNoteModal";
import {
  getDashboardData,
  logWeight,
  toggleHabitCompletion,
} from "~/modules/dashboard/infra/dashboard.service.server";
import { formatStartedAgo } from "~/time";
import { createValidationError } from "~/utils/errors";
import { formBoolean, formNumber, formText } from "~/utils/form-data";
import type { Route } from "./+types/index";
import "./index.css";

export async function loader() {
  return getDashboardData();
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "toggle-habit") {
    const schema = zfd.formData({
      habitId: formText(z.string().min(1)),
      completed: formBoolean(),
    });
    const parsed = schema.parse(form);

    await toggleHabitCompletion({
      habitId: parsed.habitId,
      completed: parsed.completed,
    });

    return null;
  }

  if (intent === "save-note") {
    const schema = zfd.formData({
      content: formText(z.string()),
    });
    const parsed = schema.parse(form);
    await saveDailyNote(parsed.content);
    return { saved: true };
  }

  const schema = zfd.formData({
    weight: formNumber(z.number().positive()),
  });

  const parsed = schema.safeParse(form);
  if (!parsed.success) {
    throw createValidationError("Invalid weight value provided", parsed.error);
  }

  await logWeight({ weight: parsed.data.weight });
}

export const handle = {
  header: () => ({
    title: "Today",
    subtitle: new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  }),
};

export default function DashboardPage({
  loaderData: {
    weight,
    lastWeight,
    weightData,
    loggedToday,
    streak,
    todayHabits,
    completionMap,
    habitStreaks,
    completedHabitsCount,
    inProgressWorkout,
    nutrition,
    dailyNote,
  },
}: Route.ComponentProps) {
  const weightFetcher = useFetcher();
  const fetchers = useFetchers();
  const weightInputId = useId();
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const noteParam = searchParams.get("note");

  const optimisticHabitToggles = fetchers.filter(
    (f) => f.formData?.get("intent") === "toggle-habit",
  );

  const optimisticCompletionMap = new Map(completionMap);
  for (const f of optimisticHabitToggles) {
    const habitId = f.formData?.get("habitId") as string;
    const completed = f.formData?.get("completed") === "true";
    optimisticCompletionMap.set(habitId, !completed);
  }

  const optimisticCompletedCount = Array.from(
    optimisticCompletionMap.values(),
  ).filter(Boolean).length;

  const [celebrate, setCelebrate] = useState(false);
  const previouslyCompletedCount = useRef(completedHabitsCount);

  useEffect(() => {
    if (
      optimisticCompletedCount === todayHabits.length &&
      todayHabits.length > 0 &&
      previouslyCompletedCount.current < todayHabits.length
    ) {
      setCelebrate(true);
    }
    previouslyCompletedCount.current = optimisticCompletedCount;
  }, [optimisticCompletedCount, todayHabits.length]);

  const habitsTotal = todayHabits.length;
  const habitsPct =
    habitsTotal > 0 ? (optimisticCompletedCount / habitsTotal) * 100 : 0;

  const [showWeightPulse, setShowWeightPulse] = useState(false);
  const prevLoggedToday = useRef(loggedToday);

  useEffect(() => {
    if (loggedToday && !prevLoggedToday.current) {
      setShowWeightPulse(true);
    }
    prevLoggedToday.current = loggedToday;
  }, [loggedToday]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || loggedToday) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        weightInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loggedToday]);

  const calPct = Math.min(nutrition.calories / nutrition.calorieTarget, 1);
  const remaining = Math.max(
    0,
    Math.round(nutrition.calorieTarget - nutrition.calories),
  );

  return (
    <Box className="dashboard">
      {noteParam && <DailyNoteModal note={dailyNote} mode={noteParam} />}
      {inProgressWorkout && (
        <Link
          to={`/workouts/${inProgressWorkout.id}`}
          className="dashboard__workout-strip"
        >
          <Box>
            <Text as="div" className="dashboard__workout-name">
              {inProgressWorkout.name}
            </Text>
            <Text as="div" className="dashboard__workout-time">
              {formatStartedAgo(
                Math.floor(
                  (Date.now() - inProgressWorkout.start.getTime()) / 60000,
                ),
              )}
            </Text>
          </Box>
          <span className="dashboard__workout-btn">Continue</span>
        </Link>
      )}

      {/* Stat banner */}
      <Box>
        <Flex className="dashboard__stat-banner">
          <Box className="dashboard__stat-cell">
            <Text as="div" className="dashboard__stat-value">
              {Math.round(nutrition.calories)}
            </Text>
            <Text as="div" className="dashboard__stat-label">
              kcal
            </Text>
            <Box
              className="dashboard__stat-progress"
              role="progressbar"
              aria-valuenow={Math.round(calPct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Daily calorie progress"
            >
              <Box
                className="dashboard__stat-progress-fill"
                style={{ width: `${calPct * 100}%` }}
              />
            </Box>
          </Box>

          <Box className="dashboard__stat-divider" />

          <Box className="dashboard__stat-cell">
            <Text as="div" className="dashboard__stat-value">
              {Math.round(nutrition.protein)}
            </Text>
            <Text as="div" className="dashboard__stat-label">
              protein g
            </Text>
          </Box>

          <Box className="dashboard__stat-divider" />

          <Box className="dashboard__stat-cell">
            <Text as="div" className="dashboard__stat-value">
              {lastWeight ? lastWeight.value : "—"}
            </Text>
            <Text as="div" className="dashboard__stat-label">
              {weight.unit}
            </Text>
          </Box>
        </Flex>

        <Flex className="dashboard__stat-subtitle">
          <Text size="1">{remaining} kcal remaining</Text>
          <Text size="1">{Math.round(calPct * 100)}% of daily goal</Text>
        </Flex>
      </Box>

      {/* Daily note */}
      <DailyNoteCard note={dailyNote} />

      {/* Habits */}
      {habitsTotal > 0 && (
        <SuccessPulse trigger={optimisticHabitToggles.length > 0}>
          <Box className="dashboard__card dashboard__card--habits">
            <Celebration
              trigger={celebrate}
              onComplete={() => setCelebrate(false)}
            />
            <Flex className="dashboard__habits-header">
              <Flex align="center" gap="2">
                <p className="section-label" style={{ marginBottom: 0 }}>
                  Habits
                </p>
                {optimisticCompletedCount === habitsTotal && (
                  <Text
                    size="1"
                    color="green"
                    weight="bold"
                    className="animate-fade-in"
                  >
                    All Done! ✨
                  </Text>
                )}
              </Flex>
              <span className="dashboard__habits-fraction">
                {optimisticCompletedCount}
                <span className="dashboard__habits-fraction-total">
                  /{habitsTotal}
                </span>
              </span>
            </Flex>

            <Box
              className="dashboard__habits-progress"
              role="progressbar"
              aria-valuenow={Math.round(habitsPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Habits completion progress"
            >
              <Box
                className="dashboard__habits-progress-fill"
                style={{ width: `${habitsPct}%` }}
              />
            </Box>

            <Box>
              {todayHabits.map((habit, i) => (
                <Box key={habit.id}>
                  {i > 0 && <hr className="rule-divider" />}
                  <HabitCheckbox
                    habitId={habit.id}
                    habitName={habit.name}
                    identityPhrase={habit.identityPhrase}
                    isCompleted={completionMap.get(habit.id) ?? false}
                    streak={habitStreaks.get(habit.id) ?? 0}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </SuccessPulse>
      )}

      {/* Weight trend */}
      <SuccessPulse trigger={showWeightPulse}>
        <Box className="dashboard__card dashboard__card--weight">
          <Flex className="dashboard__weight-header">
            <Box className="dashboard__weight-label-row" flexGrow="1">
              <Text as="label" htmlFor={weightInputId} className="section-label">
                Weight trend
              </Text>
              {streak > 0 && (
                <Text size="1" className="dashboard__weight-streak">
                  {streak}d streak
                </Text>
              )}
            </Box>
            {!loggedToday && (
              <Box display={{ initial: "none", md: "inline-block" }}>
                <Kbd size="1">W</Kbd>
              </Box>
            )}
          </Flex>

          {!loggedToday && (
            <weightFetcher.Form
              method="post"
              className="dashboard__weight-log-form"
            >
              <Box className="dashboard__weight-input">
                <NumberInput
                  ref={weightInputRef}
                  id={weightInputId}
                  name="weight"
                  min={0}
                  placeholder={lastWeight?.value?.toString() ?? "..."}
                  size="2"
                  aria-label="Weight"
                  aria-keyshortcuts="w"
                >
                  {weight?.unit && (
                    <TextField.Slot pr="3">
                      <Text size="1" color="gray">
                        {weight.unit}
                      </Text>
                    </TextField.Slot>
                  )}
                </NumberInput>
              </Box>
              <Tooltip content="Log weight (Enter)">
                <Button
                  type="submit"
                  size="2"
                  loading={weightFetcher.state !== "idle"}
                  aria-label="Log weight"
                >
                  Log
                </Button>
              </Tooltip>
            </weightFetcher.Form>
          )}

          {weightData.length > 0 && (
            <MeasurementChart
              data={weightData}
              unit={weight.unit}
              measurementName="weight"
            />
          )}
        </Box>
      </SuccessPulse>
    </Box>
  );
}
