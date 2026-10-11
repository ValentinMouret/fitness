interface Props {
  readonly remaining: number;
  readonly duration: number;
  readonly next: string;
  readonly onAdjust: (seconds: number) => void;
  readonly onSkip: () => void;
}
export const formatWorkoutClock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
};
export function ActiveWorkoutRest({
  remaining,
  duration,
  next,
  onAdjust,
  onSkip,
}: Props) {
  return (
    <section
      className={`mcp-rest ${remaining === 0 ? "mcp-rest--over" : ""}`}
      aria-label="Rest timer"
    >
      <div className="mcp-rest-main">
        <div>
          <span className="mcp-caption">◷ Rest</span>
          <strong role="timer">
            {remaining > 0 ? formatWorkoutClock(remaining) : "Rest over"}
          </strong>
        </div>
        <div className="mcp-rest-actions">
          <button
            type="button"
            aria-label="Reduce rest by 15 seconds"
            onClick={() => onAdjust(-15)}
          >
            −15
          </button>
          <button
            type="button"
            aria-label="Add 15 seconds rest"
            onClick={() => onAdjust(15)}
          >
            +15
          </button>
          <button type="button" onClick={onSkip}>
            {remaining > 0 ? "Skip" : "Dismiss"}
          </button>
        </div>
      </div>
      <p className="mcp-rest-next">{next}</p>
      <progress
        aria-label="Rest remaining"
        max={Math.max(duration, remaining, 1)}
        value={remaining}
      />
    </section>
  );
}
