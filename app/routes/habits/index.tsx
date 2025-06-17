import { data, Form, Link, useActionData, useNavigation } from "react-router";
import HabitCheckbox from "../../components/HabitCheckbox";
import { HabitCompletion } from "../../modules/habits/domain/entity";
import { HabitCompletionRepository, HabitRepository } from "../../modules/habits/infra/repository.server";
import { HabitService } from "../../modules/habits/application/service";
import { Day, today } from "../../time";
import type { Route } from "./+types/index";
import "./index.css";

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

  return (
    <div className="page habits-page">
      <header className="page-header">
        <h1>Habits</h1>
        <Link to="/habits/new" className="button button-primary">
          New Habit
        </Link>
      </header>

      {"error" in (actionData ?? {}) && (
        <div className="error-message">
          {(actionData as { error: string }).error}
        </div>
      )}

      <section className="today-habits">
        <h2>Today's Habits</h2>
        <div className="habit-list">
          {habits.filter((habit) => HabitService.isDueOn(habit, today()))
            .length === 0 ? (
            <div className="empty-state">
              <p>No habits scheduled for today.</p>
              <p>Create your first habit to get started!</p>
            </div>
          ) : (
            habits
              .filter((habit) => HabitService.isDueOn(habit, today()))
              .map((habit) => {
                const isCompleted = completionMap.get(habit.id) ?? false;
                const habitStreak = habitStreaks.get(habit.id) ?? 0;

                return (
                  <Form
                    method="post"
                    key={habit.id}
                    className="habit-form mb-1"
                  >
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
        </div>
      </section>

      <section className="all-habits">
        <h2>All Habits</h2>
        <div className="grid habit-grid">
          {habits.length === 0 ? (
            <div className="empty-state-full">
              <div className="empty-icon">📝</div>
              <h3>No habits yet</h3>
              <p>Start building better habits by creating your first one.</p>
              <Link to="/habits/new" className="button button-primary">
                Create Your First Habit
              </Link>
            </div>
          ) : (
            habits.map((habit) => {
              const habitStreak = habitStreaks.get(habit.id) ?? 0;
              const getStreakColorClass = (streak: number): string => {
                if (streak >= 90) return "streak-blue";
                if (streak >= 30) return "streak-red";
                if (streak >= 7) return "streak-orange";
                return "streak-gray";
              };

              return (
                <div key={habit.id} className="card habit-card">
                  <div className="card-header habit-card-header">
                    <h3>{habit.name}</h3>
                    <div className="card-header-right">
                      {habitStreak > 0 && (
                        <span
                          className={`streak-counter ${getStreakColorClass(habitStreak)}`}
                        >
                          🔥 {habitStreak} {habitStreak === 1 ? "day" : "days"}
                        </span>
                      )}
                      <Link
                        to={`/habits/${habit.id}/edit`}
                        className="edit-link"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                  {habit.description && <p>{habit.description}</p>}
                  <div className="habit-meta">
                    <span className="frequency">
                      {habit.frequencyType === "daily" && "Every day"}
                      {habit.frequencyType === "weekly" &&
                        habit.frequencyConfig.days_of_week && (
                          <>
                            {habit.frequencyConfig.days_of_week.length}{" "}
                            days/week
                            <span className="days-detail">
                              {" "}
                              (
                              {Day.sortDays(habit.frequencyConfig.days_of_week)
                                .map(Day.toShort)
                                .join(", ")}
                              )
                            </span>
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
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
