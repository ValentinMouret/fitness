import { Form, redirect, useActionData, Link, useLoaderData } from "react-router";
import { data } from "react-router";
import type { Route } from "./+types/edit";
import { HabitRepository, Habit as HabitEntity, type Habit } from "../../habits";
import * as React from "react";

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
  const frequencyType = formData.get("frequencyType") as HabitEntity["frequencyType"];
  
  const frequencyConfig: { days_of_week?: number[]; interval_days?: number; day_of_month?: number; } = {};
  if (frequencyType === "custom" || frequencyType === "weekly") {
    const daysOfWeek = formData.getAll("daysOfWeek").map(Number);
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
  const [frequencyType, setFrequencyType] = React.useState<string>(habit.frequencyType);

  const daysOfWeek = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  return (
    <div className="edit-habit-page">
      <header className="page-header">
        <h1>Edit Habit</h1>
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
              {daysOfWeek.map((day) => (
                <label 
                  key={day.value} 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="daysOfWeek"
                    value={day.value}
                    defaultChecked={habit.frequencyConfig.days_of_week?.includes(day.value)}
                    style={{
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      appearance: "none",
                      background: "white",
                      border: "2px solid #ccc",
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: 0,
                      position: "relative",
                    }}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link to="/habits" className="button-secondary">
            Cancel
          </Link>
          <button type="submit" className="button-primary">
            Save Changes
          </button>
        </div>
      </Form>

      <style>{`
        .edit-habit-page {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0;
        }

        .error-message {
          background: #fee;
          color: #c00;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }

        .habit-form {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label,
        .days-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
        }

        .form-group textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
        }

        .button-primary {
          background: #333;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          font-size: 1rem;
        }

        .button-primary:hover {
          background: #555;
        }

        .button-secondary {
          background: #f0f0f0;
          color: #333;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          font-size: 1rem;
        }

        .button-secondary:hover {
          background: #e0e0e0;
        }

        .days-of-week {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        input[type="checkbox"]:checked {
          background: #4caf50 !important;
          border-color: #4caf50 !important;
        }

        input[type="checkbox"]:checked::after {
          content: "✓";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 16px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}