import { Box, Button, Flex, Progress, Text } from "@radix-ui/themes";
import { Form, Link, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import HabitCheckbox from "~/components/HabitCheckbox";
import MeasurementChart from "~/components/MeasurementChart";
import { NumberInput } from "~/components/NumberInput";
import {
  getDashboardData,
  logWeight,
  toggleHabitCompletion,
} from "~/modules/dashboard/application/dashboard.service.server";
import { formatStartedAgo } from "~/time";
import { createValidationError } from "~/utils/errors";
import { formBoolean, formNumber, formText } from "~/utils/form-data";
import type { Route } from "./+types/index";

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

  return (
    <Box>
      {/* Active workout banner */}
      {inProgressWorkout && (
        <Link
          to={`/workouts/${inProgressWorkout.id}`}
          style={{ textDecoration: "none" }}
        >
          <Flex
            justify="between"
            align="center"
            px="5"
            py="4"
            mb="6"
            style={{
              background: "var(--brand-coral)",
              borderRadius: "16px",
              color: "white",
            }}
          >
            <Box>
              <Text
                size="3"
                weight="bold"
                style={{ color: "white", display: "block" }}
              >
                {inProgressWorkout.name}
              </Text>
              <Text size="2" style={{ color: "rgba(255,255,255,0.8)" }}>
                {formatStartedAgo(
                  Math.floor(
                    (Date.now() - inProgressWorkout.start.getTime()) / 60000,
                  ),
                )}
              </Text>
            </Box>
            <Button
              variant="outline"
              size="2"
              style={{
                color: "white",
                borderColor: "rgba(255,255,255,0.5)",
              }}
            >
              Continue
            </Button>
          </Flex>
        </Link>
      )}

      {/* Habits section */}
      {todayHabits.length > 0 && (
        <Box mb="8">
          <Flex justify="between" align="baseline">
            <p className="section-label">Habits</p>
            <Text size="2" style={{ color: "var(--brand-text-secondary)" }}>
              {completedHabitsCount}/{todayHabits.length}
            </Text>
          </Flex>

          <Box>
            {todayHabits.map((habit, i) => (
              <Box key={habit.id}>
                {i > 0 && <hr className="rule-divider" />}
                <Form method="post">
                  <HabitCheckbox
                    habitId={habit.id}
                    habitName={habit.name}
                    habitDescription={habit.description}
                    isCompleted={completionMap.get(habit.id) ?? false}
                    streak={habitStreaks.get(habit.id) ?? 0}
                  />
                </Form>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Weight section */}
      <Box mb="8">
        <p className="section-label">Weight</p>

        {loggedToday && lastWeight ? (
          <>
            <span className="display-number display-number--xl">
              {lastWeight.value}
              <span className="display-number--unit">{weight.unit}</span>
            </span>
            {streak > 0 && (
              <Text
                as="p"
                size="2"
                mt="2"
                style={{ color: "var(--brand-text-secondary)" }}
              >
                {streak} day streak
              </Text>
            )}
          </>
        ) : (
          <weightFetcher.Form method="post">
            <Flex gap="2" align="center">
              <Box style={{ width: "100px" }}>
                <NumberInput
                  name="weight"
                  min={0}
                  placeholder={lastWeight?.value?.toString() ?? "kg"}
                  size="2"
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

        {weightData.length > 0 && (
          <Box mt="4">
            <MeasurementChart
              data={weightData}
              unit={weight.unit}
              measurementName="weight"
            />
          </Box>
        )}
      </Box>

      {/* Calories section */}
      <Box mb="6">
        <p className="section-label">Calories</p>

        <Flex gap="6" mb="3">
          <Box>
            <span className="display-number display-number--lg">
              {Math.round(nutrition.calories)}
            </span>
            <Text
              as="p"
              size="1"
              style={{ color: "var(--brand-text-secondary)" }}
            >
              consumed
            </Text>
          </Box>
          <Box>
            <span className="display-number display-number--lg">
              {Math.round(nutrition.calorieTarget - nutrition.calories)}
            </span>
            <Text
              as="p"
              size="1"
              style={{ color: "var(--brand-text-secondary)" }}
            >
              remaining
            </Text>
          </Box>
          <Box>
            <span className="display-number display-number--lg">
              {Math.round(nutrition.protein)}
            </span>
            <Text
              as="p"
              size="1"
              style={{ color: "var(--brand-text-secondary)" }}
            >
              protein (g)
            </Text>
          </Box>
        </Flex>

        <Progress
          value={Math.min(
            (nutrition.calories / nutrition.calorieTarget) * 100,
            100,
          )}
        />
        <Flex justify="between" mt="1">
          <Text size="1" style={{ color: "var(--brand-text-secondary)" }}>
            {Math.round((nutrition.calories / nutrition.calorieTarget) * 100)}%
          </Text>
          <Text size="1" style={{ color: "var(--brand-text-secondary)" }}>
            {nutrition.calorieTarget} kcal goal
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}
