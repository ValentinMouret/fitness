import { Form, redirect, useActionData, Link } from "react-router";
import { data } from "react-router";
import type { Route } from "./+types/new";
import { HabitRepository, Habit as HabitEntity } from "../../habits";

export async function action({ request }: Route.ActionArgs) {
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
          <select id="frequencyType" name="frequencyType" required>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (specific days)</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="form-actions">
          <Link to="/habits" className="button-secondary">
            Cancel
          </Link>
          <button type="submit" className="button-primary">
            Create Habit
          </button>
        </div>
      </Form>

      <style>{`
        .new-habit-page {
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

        .form-group label {
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
      `}</style>
    </div>
  );
}