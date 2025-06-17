import "./HabitCheckbox.css";

interface HabitCheckboxProps {
  readonly habitId: string;
  readonly habitName: string;
  readonly habitDescription?: string;
  readonly isCompleted: boolean;
  readonly isSubmitting?: boolean;
  readonly intent?: string;
}

export default function HabitCheckbox({
  habitId,
  habitName,
  habitDescription,
  isCompleted,
  isSubmitting = false,
  intent = "toggle-habit",
}: HabitCheckboxProps) {
  return (
    <div className="checkbox-wrapper">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="habitId" value={habitId} />
      <input type="hidden" name="completed" value={String(isCompleted)} />
      <button
        type="submit"
        className={`checkbox-button ${isCompleted ? 'checked' : ''}`}
        disabled={isSubmitting}
      >
        {isCompleted && "✓"}
      </button>
      <span className={`checkbox-label ${isCompleted ? 'checked' : ''}`}>
        {habitName}
      </span>
      {habitDescription && (
        <span className="habit-description text-small text-muted">
          - {habitDescription}
        </span>
      )}
    </div>
  );
}