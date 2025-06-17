import {
  Form,
  redirect,
  useActionData,
  Link,
  useLoaderData,
} from "react-router";
import "./edit.css";
import { data } from "react-router";
import type { Route } from "./+types/edit";
import {
  HabitRepository,
  type Habit as HabitEntity,
  type Habit,
} from "../../habits";
import * as React from "react";
import { allDays } from "~/time";

export async function loader({ params }: Route.LoaderArgs) {
  const result = await HabitRepository.fetchById(params.id);

  if (result.isErr()) {
    throw data({ error: "Habit not found" }, { status: 404 });
  }

  return data({ habit: result.value });
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | undefined;
  const frequencyType = formData.get(
    "frequencyType",
  ) as HabitEntity["frequencyType"];

  const frequencyConfig: {
    days_of_week?: string[];
    interval_days?: number;
    day_of_month?: number;
  } = {};
  if (frequencyType === "custom" || frequencyType === "weekly") {
    const daysOfWeek = formData.getAll("daysOfWeek").map((s) => s.toString());
    if (daysOfWeek.length > 0) {
      frequencyConfig.days_of_week = daysOfWeek;
    }
  }

  const existingHabit = await HabitRepository.fetchById(params.id);
  if (existingHabit.isErr()) {
    return data({ error: "Habit not found" }, { status: 404 });
  }

  const updatedHabit: Habit = {
    ...existingHabit.value,
    name,
    description: description || undefined,
    frequencyType,
    frequencyConfig,
  };

  const result = await HabitRepository.save(updatedHabit);

  if (result.isErr()) {
    return data({ error: "Failed to update habit" }, { status: 500 });
  }

  return redirect("/habits");
}

export default function EditHabit() {
  const { habit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [frequencyType, setFrequencyType] = React.useState<string>(
    habit.frequencyType,
  );

  return (
    <div className="edit-habit-page">
      <header className="page-header">
        <h1>Edit Habit</h1>
      </header>

      {"error" in (actionData ?? {}) && (
        <div className="error-message">
          {(actionData as { error: string }).error}
        </div>
      )}

      <Form method="post" className="habit-form">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            required
            defaultValue={habit.name}
            placeholder="e.g., Go to gym"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            name="description"
            defaultValue={habit.description}
            placeholder="e.g., Weight training and cardio"
          />
        </div>

        <div className="form-group">
          <label htmlFor="frequencyType">Frequency</label>
          <select
            id="frequencyType"
            name="frequencyType"
            required
            value={frequencyType}
            onChange={(e) => setFrequencyType(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (specific days)</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {(frequencyType === "weekly" || frequencyType === "custom") && (
          <div className="form-group">
            <div className="days-label">Days of the Week</div>
            <div className="days-of-week">
              {allDays.map((day) => (
                <label key={day} className="day-checkbox">
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={day}
                    defaultChecked={habit.frequencyConfig.days_of_week?.includes(
                      day,
                    )}
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link to="/habits" className="button button-secondary">
            Cancel
          </Link>
          <button type="submit" className="button button-primary">
            Save Changes
          </button>
        </div>
      </Form>
    </div>
  );
}
