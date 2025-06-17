import { Form, redirect, useActionData, Link } from "react-router";
import "./new.css";
import { data } from "react-router";
import type { Route } from "./+types/new";
import { HabitRepository, Habit as HabitEntity } from "../../habits";
import * as React from "react";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  
  const name = formData.get("name") as string;
  const description = formData.get("description") as string | undefined;
  const frequencyType = formData.get("frequencyType") as HabitEntity["frequencyType"];
  
  const frequencyConfig: { days_of_week?: string[]; interval_days?: number; day_of_month?: number; } = {};
  if (frequencyType === "custom" || frequencyType === "weekly") {
    const daysOfWeek = formData.getAll("daysOfWeek").map(String);
    if (daysOfWeek.length > 0) {
      frequencyConfig.days_of_week = daysOfWeek;
    }
  }

  const habit = HabitEntity.create(name, frequencyType, frequencyConfig, {
    description: description || undefined,
  });

  const result = await HabitRepository.save(habit);
  
  if (result.isErr()) {
    return data({ error: "Failed to create habit" }, { status: 500 });
  }

  return redirect("/habits");
}

export default function NewHabit() {
  const actionData = useActionData<typeof action>();
  const [frequencyType, setFrequencyType] = React.useState<string>("daily");

  const daysOfWeek = [
    { value: "Sunday", label: "Sunday" },
    { value: "Monday", label: "Monday" },
    { value: "Tuesday", label: "Tuesday" },
    { value: "Wednesday", label: "Wednesday" },
    { value: "Thursday", label: "Thursday" },
    { value: "Friday", label: "Friday" },
    { value: "Saturday", label: "Saturday" },
  ];

  return (
    <div className="new-habit-page">
      <header className="page-header">
        <h1>Create New Habit</h1>
      </header>

      {"error" in (actionData ?? {}) && (
        <div className="error-message">{(actionData as { error: string }).error}</div>
      )}

      <Form method="post" className="habit-form">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="e.g., Go to gym"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            name="description"
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
              {daysOfWeek.map((day) => (
                <label 
                  key={day.value} 
                  className="day-checkbox"
                >
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={day.value}
                  />
                  <span>{day.label}</span>
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
            Create Habit
          </button>
        </div>
      </Form>

    </div>
  );
}