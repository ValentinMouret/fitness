import "./HabitCheckbox.css";

interface HabitCheckboxProps {
  readonly habitId: string;
  readonly habitName: string;
  readonly habitDescription?: string;
  readonly isCompleted: boolean;
  readonly isSubmitting?: boolean;
  readonly intent?: string;
  readonly streak?: number;
}

export default function HabitCheckbox({
  habitId,
  habitName,
  habitDescription,
  isCompleted,
  isSubmitting = false,
  intent = "toggle-habit",
  streak = 0,
}: HabitCheckboxProps) {
  const getStreakColorClass = (streak: number): string => {
    if (streak >= 90) return "streak-blue";
    if (streak >= 30) return "streak-red";
    if (streak >= 7) return "streak-orange";
    return "streak-gray";
  };

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
      <div className="habit-content">
        <span className={`checkbox-label ${isCompleted ? 'checked' : ''}`}>
          {habitName}
        </span>
        {habitDescription && (
          <span className="habit-description text-small text-muted">
            - {habitDescription}
          </span>
        )}
      </div>
      {streak > 0 && (
        <span className={`streak-counter ${getStreakColorClass(streak)}`}>
          🔥 {streak} {streak === 1 ? 'day' : 'days'}
        </span>
      )}
    </div>
  );
}