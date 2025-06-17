import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  Link,
} from "react-router";
import "./index.css";
import { data } from "react-router";
import type { Route } from "./+types/index";
import {
  HabitRepository,
  HabitCompletionRepository,
  HabitService,
  HabitCompletion,
} from "../../habits";
import { today } from "../../time";

export async function loader() {
  const habits = await HabitRepository.fetchActive();

  if (habits.isErr()) {
    throw data({ error: "Failed to load habits" }, { status: 500 });
  }

  const todayCompletions = await HabitCompletionRepository.fetchByDateRange(
    today(),
    today(),
  );

  if (todayCompletions.isErr()) {
    throw data({ error: "Failed to load completions" }, { status: 500 });
  }

  return data({
    habits: habits.value,
    todayCompletions: todayCompletions.value,
  });
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

export default function HabitsPage() {
  const { habits, todayCompletions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
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

                return (
                  <Form method="post" key={habit.id} className="habit-form mb-1">
                    <input
                      type="hidden"
                      name="intent"
                      value="toggle-completion"
                    />
                    <input type="hidden" name="habitId" value={habit.id} />
                    <input
                      type="hidden"
                      name="completed"
                      value={String(isCompleted)}
                    />

                    <div className="checkbox-wrapper">
                      <button
                        type="submit"
                        className={`checkbox-button ${isCompleted ? 'checked' : ''}`}
                        disabled={isSubmitting}
                      >
                        {isCompleted && "✓"}
                      </button>
                      <span className={`checkbox-label ${isCompleted ? 'checked' : ''}`}>
                        {habit.name}
                      </span>
                      {habit.description && (
                        <span className="habit-description text-small text-muted">
                          - {habit.description}
                        </span>
                      )}
                    </div>
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
            habits.map((habit) => (
              <div key={habit.id} className="card habit-card">
                <div className="card-header habit-card-header">
                  <h3>{habit.name}</h3>
                  <Link to={`/habits/${habit.id}/edit`} className="edit-link">
                    Edit
                  </Link>
                </div>
                {habit.description && <p>{habit.description}</p>}
                <div className="habit-meta">
                  <span className="frequency">
                    {habit.frequencyType === "daily" && "Every day"}
                    {habit.frequencyType === "weekly" &&
                      habit.frequencyConfig.days_of_week && (
                        <>
                          {habit.frequencyConfig.days_of_week.length} days/week
                          <span className="days-detail">
                            {" "}
                            ({habit.frequencyConfig.days_of_week
                              .sort((a, b) => a - b)
                              .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                              .join(", ")})
                          </span>
                        </>
                      )}
                    {habit.frequencyType === "monthly" && "Monthly"}
                    {habit.frequencyType === "custom" && 
                      habit.frequencyConfig.days_of_week && (
                        <>
                          Custom: {habit.frequencyConfig.days_of_week
                            .sort((a, b) => a - b)
                            .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                            .join(", ")}
                        </>
                      )}
                    {habit.frequencyType === "custom" && 
                      !habit.frequencyConfig.days_of_week && 
                      "Custom schedule"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
