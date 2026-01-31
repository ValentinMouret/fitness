import { useEffect, useState } from "react";
import { Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Grid,
  Text,
} from "@radix-ui/themes";
import { data, Form, Link, useNavigation } from "react-router";
import { handleResultError } from "~/utils/errors";
import { EmptyState } from "~/components/EmptyState";
import { SectionHeader } from "~/components/SectionHeader";
import { Celebration } from "~/components/Celebration";
import HabitCheckbox from "../../components/HabitCheckbox";
import { HabitService } from "../../modules/habits/application/service";
import { HabitCompletion } from "../../modules/habits/domain/entity";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "../../modules/habits/infra/repository.server";
import { Day, isSameDay, today } from "../../time";
import type { Route } from "./+types/index";

export async function loader() {
  const habitsResult = await HabitRepository.fetchActive();
  if (habitsResult.isErr()) {
    handleResultError(habitsResult, "Failed to load habits");
  }

  const habits = habitsResult.value;
  const todayDate = today();

  // Find earliest start date to fetch all relevant completions at once
  const earliestDate = habits.reduce(
    (min, h) => (h.startDate < min ? h.startDate : min),
    todayDate,
  );

  const completionsResult = await HabitCompletionRepository.fetchByDateRange(
    earliestDate,
    todayDate,
  );
  if (completionsResult.isErr()) {
    handleResultError(completionsResult, "Failed to load completions");
  }

  // Group completions by habit for streak calculation
  const completionsByHabit = Map.groupBy(
    completionsResult.value,
    (c) => c.habitId,
  );

  const habitStreaks: Record<string, number> = {};
  const completionMap: Record<string, boolean> = {};

  for (const habit of habits) {
    const habitCompletions = completionsByHabit.get(habit.id) || [];
    habitStreaks[habit.id] = HabitService.calculateStreak(
      habit,
      habitCompletions,
      todayDate,
    );

    const todayCompletion = habitCompletions.find((c) =>
      isSameDay(c.completionDate, todayDate),
    );
    if (todayCompletion) {
      completionMap[habit.id] = todayCompletion.completed;
    }
  }

  const todayHabits = habits.filter((habit) =>
    HabitService.isDueOn(habit, todayDate),
  );

  const completedTodayCount = todayHabits.filter(
    (habit) => completionMap[habit.id],
  ).length;

  return {
    habits,
    todayHabits,
    completionMap,
    habitStreaks,
    todayHabitsCount: todayHabits.length,
    completedTodayCount,
  };
}

export const handle = {
  header: (data: Route.ComponentProps["loaderData"]) => {
    return {
      title: "Habits",
      customRight: data.todayHabitsCount > 0 && (
        <Badge
          size="2"
          color={
            data.completedTodayCount === data.todayHabitsCount
              ? "tomato"
              : "gray"
          }
          variant="soft"
        >
          {data.completedTodayCount}/{data.todayHabitsCount}
        </Badge>
      ),
      primaryAction: {
        label: "New Habit",
        to: "/habits/new",
        icon: <PlusIcon />,
      },
    };
  },
};

const STREAK_MILESTONES = [7, 30, 90, 365];

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle-completion") {
    const habitId = formData.get("habitId")?.toString() ?? "";
    const completed = formData.get("completed") === "true";
    const notes = formData.get("notes")?.toString();

    const completion = HabitCompletion.create(
      habitId,
      today(),
      !completed,
      notes,
    );

    const result = await HabitCompletionRepository.save(completion);

    if (result.isErr()) {
      return data({ error: "Failed to save completion" }, { status: 500 });
    }

    // Check for streak milestone when completing (not uncompleting)
    let hitMilestone: number | null = null;
    if (!completed) {
      const habit = await HabitRepository.fetchById(habitId);
      if (habit.isOk() && habit.value) {
        const completions = await HabitCompletionRepository.fetchByHabitBetween(
          habitId,
          new Date(habit.value.startDate),
          today(),
        );
        if (completions.isOk()) {
          const newStreak = HabitService.calculateStreak(
            habit.value,
            completions.value,
            today(),
          );
          if (STREAK_MILESTONES.includes(newStreak)) {
            hitMilestone = newStreak;
          }
        }
      }
    }

    return data({ success: true, hitMilestone });
  }

  return null;
}

export default function HabitsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { habits, todayHabits, completionMap, habitStreaks } = loaderData;
  const navigation = useNavigation();
  const [showCelebration, setShowCelebration] = useState(false);

  // Trigger celebration when a streak milestone is hit
  useEffect(() => {
    if (actionData && "hitMilestone" in actionData && actionData.hitMilestone) {
      setShowCelebration(true);
    }
  }, [actionData]);

  const isSubmitting = navigation.state === "submitting";

  const getStreakColor = (
    streak: number,
  ): "blue" | "red" | "orange" | "gray" => {
    if (streak >= 90) return "blue";
    if (streak >= 30) return "red";
    if (streak >= 7) return "orange";
    return "gray";
  };

  return (
    <Box>
      <Celebration
        trigger={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {actionData && "error" in actionData && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{actionData.error}</Callout.Text>
        </Callout.Root>
      )}

      <Box mb="8">
        <SectionHeader title="Today's Habits" />
        <Flex direction="column" gap="2">
          {todayHabits.length === 0 ? (
            <EmptyState
              icon="📅"
              title="All caught up!"
              description="No habits scheduled for today. Enjoy your rest day!"
            />
          ) : (
            todayHabits.map((habit) => {
              const isCompleted = completionMap[habit.id] ?? false;
              const habitStreak = habitStreaks[habit.id] ?? 0;

              return (
                <Form method="post" key={habit.id}>
                  <HabitCheckbox
                    habitId={habit.id}
                    habitName={habit.name}
                    habitDescription={habit.description}
                    isCompleted={isCompleted}
                    isSubmitting={isSubmitting}
                    intent="toggle-completion"
                    streak={habitStreak}
                  />
                </Form>
              );
            })
          )}
        </Flex>
      </Box>

      <Box>
        <SectionHeader title="All Habits" />
        {habits.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No habits yet"
            description="Start building better habits by creating your first one."
            actionLabel="Create Your First Habit"
            actionTo="/habits/new"
          />
        ) : (
          <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
            {habits.map((habit) => {
              const habitStreak = habitStreaks[habit.id] ?? 0;

              return (
                <Card key={habit.id} size="3">
                  <Flex justify="between" align="start" mb="2">
                    <Text weight="bold" size="4">
                      {habit.name}
                    </Text>
                    <Flex gap="2" align="center">
                      {habitStreak > 0 && (
                        <Badge
                          color={getStreakColor(habitStreak)}
                          variant="soft"
                        >
                          🔥 {habitStreak} {habitStreak === 1 ? "day" : "days"}
                        </Badge>
                      )}
                      <Button asChild variant="ghost" size="1">
                        <Link to={`/habits/${habit.id}/edit`}>
                          <Pencil1Icon />
                        </Link>
                      </Button>
                    </Flex>
                  </Flex>

                  {habit.description && (
                    <Text
                      color="gray"
                      size="2"
                      mb="3"
                      style={{ display: "block" }}
                    >
                      {habit.description}
                    </Text>
                  )}

                  <Text size="2" color="gray">
                    {habit.frequencyType === "daily" && "Every day"}
                    {habit.frequencyType === "weekly" &&
                      habit.frequencyConfig.days_of_week && (
                        <>
                          {habit.frequencyConfig.days_of_week.length} days/week{" "}
                          (
                          {Day.sortDays(habit.frequencyConfig.days_of_week)
                            .map(Day.toShort)
                            .join(", ")}
                          )
                        </>
                      )}
                    {habit.frequencyType === "monthly" && "Monthly"}
                    {habit.frequencyType === "custom" &&
                      habit.frequencyConfig.days_of_week && (
                        <>
                          Custom:{" "}
                          {Day.sortDays(habit.frequencyConfig.days_of_week)
                            .map(Day.toShort)
                            .join(", ")}
                        </>
                      )}
                    {habit.frequencyType === "custom" &&
                      !habit.frequencyConfig.days_of_week &&
                      "Custom schedule"}
                  </Text>
                </Card>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
