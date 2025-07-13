import { data, Form, Link, useNavigation } from "react-router";
import HabitCheckbox from "../../components/HabitCheckbox";
import { HabitCompletion } from "../../modules/habits/domain/entity";
import {
  HabitCompletionRepository,
  HabitRepository,
} from "../../modules/habits/infra/repository.server";
import { HabitService } from "../../modules/habits/application/service";
import { Day, today } from "../../time";
import type { Route } from "./+types/index";
import {
  Box,
  Heading,
  Button,
  Text,
  Flex,
  Card,
  Grid,
  Callout,
  Badge,
} from "@radix-ui/themes";
import { PlusIcon, Pencil1Icon } from "@radix-ui/react-icons";

export async function loader() {
  const habits = await HabitRepository.fetchActive();

  if (habits.isErr()) {
    throw new Response("Failed to load habits", { status: 500 });
  }

  const todayCompletions = await HabitCompletionRepository.fetchByDateRange(
    today(),
    today(),
  );

  if (todayCompletions.isErr()) {
    throw new Response("Failed to load completions", { status: 500 });
  }

  // Calculate streaks for each habit
  const habitStreaks = new Map<string, number>();
  const todayDate = today();

  for (const habit of habits.value) {
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
      habitStreaks.set(habit.id, streak);
    }
  }

  return {
    habits: habits.value,
    todayCompletions: todayCompletions.value,
    habitStreaks,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle-completion") {
    const habitId = formData.get("habitId") as string;
    const completed = formData.get("completed") === "true";
    const notes = formData.get("notes") as string | undefined;

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

    return data({ success: true });
  }

  return null;
}

export default function HabitsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { habits, todayCompletions, habitStreaks } = loaderData;
  const navigation = useNavigation();

  // Create a map of today's completions
  const completionMap = new Map(
    todayCompletions.map((c) => [c.habitId, c.completed]),
  );

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
      <Flex justify="between" align="center" mb="6">
        <Heading size="7">Habits</Heading>
        <Button asChild>
          <Link to="/habits/new">
            <PlusIcon />
            New Habit
          </Link>
        </Button>
      </Flex>

      {"error" in (actionData ?? {}) && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{(actionData as { error: string }).error}</Callout.Text>
        </Callout.Root>
      )}

      <Box mb="8">
        <Heading size="5" mb="4">
          Today's Habits
        </Heading>
        <Flex direction="column" gap="2">
          {habits.filter((habit) => HabitService.isDueOn(habit, today()))
            .length === 0 ? (
            <Box p="6" style={{ textAlign: "center" }}>
              <Text color="gray">No habits scheduled for today.</Text>
              <Text color="gray">Create your first habit to get started!</Text>
            </Box>
          ) : (
            habits
              .filter((habit) => HabitService.isDueOn(habit, today()))
              .map((habit) => {
                const isCompleted = completionMap.get(habit.id) ?? false;
                const habitStreak = habitStreaks.get(habit.id) ?? 0;

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
        <Heading size="5" mb="4">
          All Habits
        </Heading>
        {habits.length === 0 ? (
          <Card size="4" style={{ textAlign: "center" }}>
            <Text size="6" mb="4">
              📝
            </Text>
            <Heading size="4" mb="2">
              No habits yet
            </Heading>
            <Text color="gray" mb="4">
              Start building better habits by creating your first one.
            </Text>
            <Button asChild>
              <Link to="/habits/new">Create Your First Habit</Link>
            </Button>
          </Card>
        ) : (
          <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
            {habits.map((habit) => {
              const habitStreak = habitStreaks.get(habit.id) ?? 0;

              return (
                <Card key={habit.id} size="3">
                  <Flex justify="between" align="start" mb="2">
                    <Heading size="4">{habit.name}</Heading>
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
