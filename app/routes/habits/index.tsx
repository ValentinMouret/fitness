import {
  useLoaderData,
  Form,
  useActionData,
  useNavigation,
  Link,
} from "react-router";
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
    <div className="habits-page">
      <header className="page-header">
        <h1>Habits</h1>
        <Link to="/habits/new" className="button-primary">
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
                  <Form method="post" key={habit.id} className="habit-item">
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

                    <button
                      type="submit"
                      className={`habit-toggle ${isCompleted ? "completed" : ""}`}
                      disabled={isSubmitting}
                    >
                      <span className="habit-checkbox">
                        {isCompleted ? "✓" : ""}
                      </span>
                      <span className="habit-name">{habit.name}</span>
                      {habit.description && (
                        <span className="habit-description">
                          {habit.description}
                        </span>
                      )}
                    </button>
                  </Form>
                );
              })
          )}
        </div>
      </section>

      <section className="all-habits">
        <h2>All Habits</h2>
        <div className="habit-grid">
          {habits.length === 0 ? (
            <div className="empty-state-full">
              <div className="empty-icon">📝</div>
              <h3>No habits yet</h3>
              <p>Start building better habits by creating your first one.</p>
              <Link to="/habits/new" className="button-primary">
                Create Your First Habit
              </Link>
            </div>
          ) : (
            habits.map((habit) => (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                {habit.description && <p>{habit.description}</p>}
                <div className="habit-meta">
                  <span className="frequency">
                    {habit.frequencyType === "daily" && "Every day"}
                    {habit.frequencyType === "weekly" &&
                      habit.frequencyConfig.days_of_week &&
                      `${habit.frequencyConfig.days_of_week.length} days/week`}
                    {habit.frequencyType === "monthly" && "Monthly"}
                    {habit.frequencyType === "custom" && "Custom schedule"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <style>{`
        .habits-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0;
        }

        .button-primary {
          background: #333;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }

        .button-primary:hover {
          background: #555;
        }

        .button-secondary {
          background: #f0f0f0;
          color: #333;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .error-message {
          background: #fee;
          color: #c00;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }

        .today-habits {
          margin-bottom: 3rem;
        }

        .today-habits h2 {
          margin-bottom: 1rem;
        }

        .habit-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .habit-item {
          display: block;
        }

        .habit-toggle {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
          padding: 1rem;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .habit-toggle:hover {
          border-color: #333;
        }

        .habit-toggle.completed {
          background: #f0f8f0;
          border-color: #4caf50;
        }

        .habit-toggle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .habit-checkbox {
          width: 24px;
          height: 24px;
          border: 2px solid #333;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #4caf50;
        }

        .completed .habit-checkbox {
          background: #4caf50;
          border-color: #4caf50;
          color: white;
        }

        .habit-name {
          font-weight: 500;
          flex: 1;
        }

        .habit-description {
          color: #666;
          font-size: 0.9rem;
        }

        .all-habits h2 {
          margin-bottom: 1rem;
        }

        .habit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
        }

        .habit-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 1.5rem;
        }

        .habit-card h3 {
          margin: 0 0 0.5rem 0;
        }

        .habit-card p {
          color: #666;
          margin: 0 0 1rem 0;
        }

        .habit-meta {
          font-size: 0.9rem;
          color: #666;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .empty-state p {
          margin: 0.5rem 0;
        }

        .empty-state-full {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .empty-state-full h3 {
          margin: 0 0 1rem 0;
          color: #333;
        }

        .empty-state-full p {
          margin: 0 0 2rem 0;
          font-size: 1.1rem;
        }

      `}</style>
    </div>
  );
}
