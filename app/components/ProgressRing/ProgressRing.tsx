import "./ProgressRing.css";

interface ProgressRingProps {
  /** Completed fraction between 0 and 1. */
  readonly value: number;
  readonly size: number;
  readonly stroke: number;
  readonly className?: string;
}

/** A circular progress indicator coloured through `--ring-color` and `--ring-track`. */
export function ProgressRing({
  value,
  size,
  stroke,
  className,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <svg
      width={size}
      height={size}
      className={className ? `progress-ring ${className}` : "progress-ring"}
      aria-hidden="true"
    >
      <circle
        className="progress-ring__track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
      />
      <circle
        className="progress-ring__value"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
      />
    </svg>
  );
}
