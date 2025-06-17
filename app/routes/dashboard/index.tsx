import { ok, ResultAsync } from "neverthrow";
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
    <div>
      <h1>Today</h1>
      
      {/* Weight Section */}
      <section>
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
        <section>
          <h2>Today's Habits</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {todayHabits.map((habit) => {
              const isCompleted = completionMap.get(habit.id) ?? false;
              return (
                <li key={habit.id} style={{ marginBottom: "1rem" }}>
                  <Form method="post" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input type="hidden" name="intent" value="toggle-habit" />
                    <input type="hidden" name="habitId" value={habit.id} />
                    <input type="hidden" name="completed" value={String(isCompleted)} />
                    <button
                      type="submit"
                      style={{
                        background: isCompleted ? "#4caf50" : "white",
                        border: `2px solid ${isCompleted ? "#4caf50" : "#ccc"}`,
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        color: isCompleted ? "white" : "transparent",
                        padding: 0,
                      }}
                    >
                      {isCompleted && "✓"}
                    </button>
                    <span style={{ textDecoration: isCompleted ? "line-through" : "none" }}>
                      {habit.name}
                    </span>
                    {habit.description && (
                      <span style={{ fontSize: "0.875rem", color: "#666" }}>
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
