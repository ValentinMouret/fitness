import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { Link, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import HabitCheckbox from "~/components/HabitCheckbox";
import MeasurementChart from "~/components/MeasurementChart";
import { NumberInput } from "~/components/NumberInput";
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
  },
}: Route.ComponentProps) {
  const weightFetcher = useFetcher();

  const habitsTotal = todayHabits.length;
  const habitsPct =
    habitsTotal > 0 ? (completedHabitsCount / habitsTotal) * 100 : 0;
  const calPct = Math.min(nutrition.calories / nutrition.calorieTarget, 1);
  const remaining = Math.max(
    0,
    Math.round(nutrition.calorieTarget - nutrition.calories),
  );

  return (
    <Box className="dashboard">
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
            <Box className="dashboard__stat-progress">
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

      {/* Habits */}
      {habitsTotal > 0 && (
        <Box className="dashboard__card dashboard__card--habits">
          <Flex className="dashboard__habits-header">
            <p className="section-label">Habits</p>
            <span className="dashboard__habits-fraction">
              {completedHabitsCount}
              <span className="dashboard__habits-fraction-total">
                /{habitsTotal}
              </span>
            </span>
          </Flex>

          <Box className="dashboard__habits-progress">
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
      )}

      {/* Weight trend */}
      <Box className="dashboard__card dashboard__card--weight">
        <Flex className="dashboard__weight-header">
          <Box className="dashboard__weight-label-row">
            <p className="section-label">Weight trend</p>
            {streak > 0 && (
              <Text size="1" className="dashboard__weight-streak">
                {streak}d streak
              </Text>
            )}
          </Box>
        </Flex>

        {!loggedToday && (
          <weightFetcher.Form
            method="post"
            className="dashboard__weight-log-form"
          >
            <Box className="dashboard__weight-input">
              <NumberInput
                name="weight"
                min={0}
                placeholder={lastWeight?.value?.toString() ?? "kg"}
                size="2"
                aria-label="Weight"
              />
            </Box>
            <Button
              type="submit"
              size="2"
              loading={weightFetcher.state !== "idle"}
            >
              Log
            </Button>
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
    </Box>
  );
}
