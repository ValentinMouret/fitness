import { ResultAsync } from "neverthrow";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import { Measure } from "~/modules/core/domain/measure";
import { HabitCompletion } from "~/modules/habits/domain/entity";
import {
  HabitRepository,
  HabitCompletionRepository,
} from "~/modules/habits/infra/repository.server";
import { HabitService } from "~/modules/habits/application/service";
import { isSameDay, today } from "~/time";
import type { Route } from "./+types/index";
import { Form, useLoaderData } from "react-router";
import { coerceFloat, resultFromNullable } from "~/utils";
import HabitCheckbox from "~/components/HabitCheckbox";
import WeightChart from "~/components/WeightChart";
import {
  Box,
  Heading,
  Text,
  TextField,
  Button,
  Flex,
  Card,
  Badge,
} from "@radix-ui/themes";
import { MeasureRepository } from "~/modules/core/infra/measure.repository.server";
import { MeasurementService } from "~/modules/core/application/measurement-service";

export async function loader() {
  const now = new Date();
  const todayDate = today();

  const result = await ResultAsync.combine([
    MeasureRepository.fetchByMeasurementName("weight", 1),
    MeasureRepository.fetchByMeasurementName("weight", 200), // Fetch more data for chart
    MeasurementRepository.fetchByName("weight"),
    MeasurementService.fetchStreak("weight"),
    HabitRepository.fetchActive(),
    HabitCompletionRepository.fetchByDateRange(todayDate, todayDate),
  ])
    .map(([weights, weightData, weight, streak, habits, completions]) => {
      // Filter habits that are due today
      const todayHabits = habits.filter((h) =>
        HabitService.isDueOn(h, todayDate),
      );

      // Create completion map
      const completionMap = new Map(
        completions.map((c) => [c.habitId, c.completed]),
      );

      return {
        weight,
        streak,
        lastWeight: weights?.[0],
        weightData,
        loggedToday: weights?.[0] && isSameDay(weights?.[0].t, now),
        todayHabits,
        completionMap,
      };
    })
    .andThen((data) => {
      // Calculate streaks for each habit
      const habitStreakPromises = data.todayHabits.map(async (habit) => {
        const habitCompletions =
          await HabitCompletionRepository.fetchByHabitBetween(
            habit.id,
            new Date(habit.startDate),
            todayDate,
          );

        if (habitCompletions.isOk()) {
          const streak = HabitService.calculateStreak(
            habit,
            habitCompletions.value,
            todayDate,
          );
          return [habit.id, streak] as const;
        }
        return [habit.id, 0] as const;
      });

      return ResultAsync.fromPromise(
        Promise.all(habitStreakPromises),
        (err) => {
          console.error(err);
          return "database_error" as const;
        },
      ).map((streakPairs) => {
        const habitStreaks = new Map(streakPairs);
        return {
          ...data,
          habitStreaks,
        };
      });
    });

  if (result.isOk()) {
    return result.value;
  }

  throw new Response(result.error, {
    status: 500,
    statusText: "Failed to fetch dashboard data",
  });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "toggle-habit") {
    const habitId = form.get("habitId") as string;
    const completed = form.get("completed") === "true";

    const completion = HabitCompletion.create(habitId, today(), !completed);

    const result = await HabitCompletionRepository.save(completion);

    if (result.isErr()) {
      throw new Response(result.error, {
        status: 500,
        statusText: "Failed to toggle habit",
      });
    }

    return null;
  }

  // Default weight logging
  const result = await resultFromNullable(
    form.get("weight")?.toString(),
    "validation_error",
  )
    .andThen(coerceFloat)
    .asyncMap(async (weight) =>
      MeasureRepository.save(Measure.create("weight", weight)),
    );

  if (result.isErr()) {
    throw new Response(result.error, {
      status: 500,
      statusText: "Failed to save weight",
    });
  }
}

export default function DashboardPage() {
  const {
    weight,
    lastWeight,
    weightData,
    loggedToday,
    streak,
    todayHabits,
    completionMap,
    habitStreaks,
  } = useLoaderData<typeof loader>();

  return (
    <Box>
      <Heading size="7" mb="6">
        Today
      </Heading>

      {/* Weight Section */}
      <Card size="3" mb="6">
        <Heading size="4" mb="4">
          Weight
        </Heading>
        {loggedToday ? (
          <Flex direction="column" gap="2">
            <Text size="3">
              Weight: {lastWeight.value}
              {weight.unit}
            </Text>
            <Flex align="center" gap="2">
              <Text size="2" color="gray">
                Streak:
              </Text>
              <Badge variant="soft" color="green">
                {streak} days
              </Badge>
            </Flex>
          </Flex>
        ) : (
          <Form method="post">
            <Flex direction="column" gap="3">
              <Text size="2" color="gray">
                You have not logged today's weight
              </Text>
              <Flex gap="2" align="end">
                <Box flexGrow="1">
                  <Text
                    as="label"
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: "block" }}
                  >
                    Weight:
                  </Text>
                  <TextField.Root
                    name="weight"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Enter weight"
                  />
                </Box>
                <Button type="submit">Submit</Button>
              </Flex>
            </Flex>
          </Form>
        )}
      </Card>

      {/* Weight Chart Section */}
      {weightData.length > 0 && (
        <Card size="3" mb="6">
          <WeightChart data={weightData} unit={weight.unit} />
        </Card>
      )}

      {/* Habits Section */}
      {todayHabits.length > 0 && (
        <Card size="3">
          <Heading size="4" mb="4">
            Today's Habits
          </Heading>
          <Flex direction="column" gap="2">
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
          </Flex>
        </Card>
      )}
    </Box>
  );
}
