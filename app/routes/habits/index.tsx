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
import { EmptyState } from "~/components/EmptyState";
import { SectionHeader } from "~/components/SectionHeader";
import { Celebration } from "~/components/Celebration";
import HabitCheckbox from "../../components/HabitCheckbox";
import { Day } from "../../time";
import type { Route } from "./+types/index";
import {
  getHabitsPageData,
  toggleHabitCompletion,
} from "~/modules/habits/application/habits-page.service.server";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { formBoolean, formOptionalText, formText } from "~/utils/form-data";

export async function loader() {
  return getHabitsPageData();
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

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intentSchema = zfd.formData({
    intent: formOptionalText(),
  });
  const intentParsed = intentSchema.parse(formData);
  const intent = intentParsed.intent;

  if (intent === "toggle-completion") {
    const schema = zfd.formData({
      habitId: formText(z.string().min(1)),
      completed: formBoolean(),
      notes: formOptionalText(),
    });
    const parsed = schema.parse(formData);

    const result = await toggleHabitCompletion({
      habitId: parsed.habitId,
      completed: parsed.completed,
      notes: parsed.notes,
    });

    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }

    return data({ success: true, hitMilestone: result.hitMilestone });
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
