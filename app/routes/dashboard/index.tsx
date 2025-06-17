import { ok, ResultAsync } from "neverthrow";
import "./index.css";
import {
  Measure,
  MeasurementRepository,
  MeasurementService,
  MeasureRepository,
} from "~/measurements";
import { HabitRepository, HabitCompletionRepository, HabitService, HabitCompletion } from "~/habits";
import { isSameDay, today } from "~/time";
import type { Route } from "./+types/index";
import { Form } from "react-router";
import { coerceFloat, resultFromNullable } from "~/utils";

export async function loader() {
  const now = new Date();
  const todayDate = today();

  const result = await ResultAsync.combine([
    MeasureRepository.fetchByMeasurementName("weight", 1),
    MeasurementRepository.fetchByName("weight"),
    MeasurementService.fetchStreak("weight"),
    HabitRepository.fetchActive(),
    HabitCompletionRepository.fetchByDateRange(todayDate, todayDate),
  ]).map(([weights, weight, streak, habits, completions]) => {
    // Filter habits that are due today
    const todayHabits = habits.filter(h => HabitService.isDueOn(h, todayDate));
    
    // Create completion map
    const completionMap = new Map(
      completions.map(c => [c.habitId, c.completed])
    );
    
    return {
      weight,
      streak,
      lastWeight: weights?.[0],
      loggedToday: weights?.[0] && isSameDay(weights?.[0].t, now),
      todayHabits,
      completionMap,
    };
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
    
    const completion = HabitCompletion.create(
      habitId,
      today(),
      !completed,
    );
    
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

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { weight, lastWeight, loggedToday, streak, todayHabits, completionMap } = loaderData;

  return (
    <div className="page dashboard-page">
      <h1>Today</h1>
      
      {/* Weight Section */}
      <section className="dashboard-section">
        <h2>Weight</h2>
      {loggedToday ? (
        <>
          <p>
            Weight: {lastWeight.value}
            {weight.unit}
          </p>
          <p>Streak: {streak} days</p>
        </>
      ) : (
        <Form method="post">
          <p>You have not logged today’s weight</p>
          <label htmlFor="weight">Weight:</label>
          <input id="weight" name="weight" type="number" min={0} step={0.1} />
          <br />
          <button type="submit">Submit</button>
        </Form>
      )}
      </section>
      
      {/* Habits Section */}
      {todayHabits.length > 0 && (
        <section className="dashboard-section">
          <h2>Today's Habits</h2>
          <ul className="habit-list">
            {todayHabits.map((habit) => {
              const isCompleted = completionMap.get(habit.id) ?? false;
              return (
                <li key={habit.id} className="mb-2">
                  <Form method="post" className="habit-form checkbox-wrapper">
                    <input type="hidden" name="intent" value="toggle-habit" />
                    <input type="hidden" name="habitId" value={habit.id} />
                    <input type="hidden" name="completed" value={String(isCompleted)} />
                    <button
                      type="submit"
                      className={`checkbox-button ${isCompleted ? 'checked' : ''}`}
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
                  </Form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
