import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Progress,
  Text,
} from "@radix-ui/themes";
import { SectionHeader } from "~/components/SectionHeader";
import { NumberInput } from "~/components/NumberInput";
import { Form, Link, useFetcher } from "react-router";
import HabitCheckbox from "~/components/HabitCheckbox";
import MeasurementChart from "~/components/MeasurementChart";
import { formatStartedAgo } from "~/time";
import { coerceFloat, resultFromNullable } from "~/utils";
import { createValidationError } from "~/utils/errors";
import type { Route } from "./+types/index";
import {
  getDashboardData,
  logWeight,
  toggleHabitCompletion,
} from "~/modules/dashboard/application/dashboard.service.server";

export async function loader() {
  return getDashboardData();
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "toggle-habit") {
    const habitIdValue = form.get("habitId");
    const habitId = typeof habitIdValue === "string" ? habitIdValue : "";
    const completed = form.get("completed") === "true";
    await toggleHabitCompletion({ habitId, completed });

    return null;
  }

  const weightValue = form.get("weight");
  const parsedWeight = resultFromNullable(
    typeof weightValue === "string" ? weightValue : null,
    "validation_error",
  ).andThen(coerceFloat);

  if (parsedWeight.isErr()) {
    throw createValidationError(
      "Invalid weight value provided",
      parsedWeight.error,
    );
  }

  await logWeight({ weight: parsedWeight.value });
}

export const handle = {
  header: () => ({
    title: "Today",
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

  return (
    <Box>
      {inProgressWorkout && (
        <Card size="3" mb="4" asChild>
          <Link
            to={`/workouts/${inProgressWorkout.id}`}
            style={{ textDecoration: "none" }}
          >
            <Flex justify="between" align="center">
              <Flex direction="column" gap="1">
                <Flex align="center" gap="2">
                  <Text size="4">🏋️</Text>
                  <Heading size="4">{inProgressWorkout.name}</Heading>
                </Flex>
                <Text size="2" color="orange">
                  {formatStartedAgo(
                    Math.floor(
                      (Date.now() - inProgressWorkout.start.getTime()) / 60000,
                    ),
                  )}
                </Text>
              </Flex>
              <Button size="3">Continue</Button>
            </Flex>
          </Link>
        </Card>
      )}

      <Card size="3" mb="4">
        <SectionHeader
          title="Today's Focus"
          right={
            todayHabits.length > 0 && (
              <Badge
                color={
                  completedHabitsCount === todayHabits.length
                    ? "tomato"
                    : "gray"
                }
                variant="soft"
              >
                {completedHabitsCount}/{todayHabits.length} complete
              </Badge>
            )
          }
        />

        <Flex direction="column" gap="3">
          {todayHabits.map((habit) => {
            const isCompleted = completionMap.get(habit.id) ?? false;
            const habitStreak = habitStreaks.get(habit.id) ?? 0;
            return (
              <Form key={habit.id} method="post">
                <HabitCheckbox
                  habitId={habit.id}
                  habitName={habit.name}
                  habitDescription={habit.description}
                  isCompleted={isCompleted}
                  streak={habitStreak}
                />
              </Form>
            );
          })}

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
            <Text size="3">⚖️</Text>
            <Flex direction="column" flexGrow="1">
              <Text size="3" weight="medium">
                Weight
              </Text>
              {loggedToday && lastWeight ? (
                <Text size="2" color="gray">
                  {lastWeight.value} {weight.unit} logged
                </Text>
              ) : (
                <Text size="2" color="gray">
                  Not logged yet
                </Text>
              )}
            </Flex>

            {loggedToday ? (
              <Badge variant="soft" color="tomato">
                ✓ {streak} days
              </Badge>
            ) : (
              <weightFetcher.Form method="post">
                <Flex gap="2" align="center">
                  <Box style={{ width: "80px" }}>
                    <NumberInput
                      name="weight"
                      min={0}
                      placeholder={lastWeight?.value?.toString() ?? "kg"}
                      size="1"
                    />
                  </Box>
                  <Button
                    type="submit"
                    size="2"
                    disabled={weightFetcher.state !== "idle"}
                  >
                    Log
                  </Button>
                </Flex>
              </weightFetcher.Form>
            )}
          </Flex>

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
            <Text size="3">🍽️</Text>
            <Box flexGrow="1">
              <Flex justify="between" align="center" mb="1">
                <Text size="3" weight="medium">
                  Calories
                </Text>
                <Text size="2" color="gray">
                  {Math.round(nutrition.calories)} / {nutrition.calorieTarget}
                </Text>
              </Flex>
              <Progress
                value={Math.min(
                  (nutrition.calories / nutrition.calorieTarget) * 100,
                  100,
                )}
              />
            </Box>
            <Button variant="outline" size="2" asChild>
              <Link to="/nutrition/meals">Log</Link>
            </Button>
          </Flex>
        </Flex>
      </Card>

      {weightData.length > 0 && (
        <Card size="3">
          <SectionHeader title="Weight Trend" />
          <MeasurementChart
            data={weightData}
            unit={weight.unit}
            measurementName="weight"
          />
        </Card>
      )}
    </Box>
  );
}
