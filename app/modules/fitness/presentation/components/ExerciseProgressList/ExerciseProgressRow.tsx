import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { VisuallyHidden } from "@radix-ui/themes";
import { Check, ChevronRight, GripVertical } from "lucide-react";
import { Link } from "react-router";
import { ProgressRing } from "~/components/ProgressRing";
import type { ActiveExerciseViewModel } from "../../view-models/active-workout.view-model";

interface ExerciseProgressRowProps {
  readonly exercise: ActiveExerciseViewModel;
  readonly to: string;
  readonly sortable: boolean;
}

const statusLabel = (exercise: ActiveExerciseViewModel) =>
  exercise.status === "done"
    ? "done"
    : `${exercise.completedSets} of ${exercise.totalSets} sets`;

/** An exercise in the workout overview, reorderable by its grip. */
export function ExerciseProgressRow({
  exercise,
  to,
  sortable,
}: ExerciseProgressRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, disabled: !sortable });
  const className = [
    "exercise-row",
    exercise.status === "done" && "exercise-row--done",
    exercise.status === "active" && "exercise-row--active",
    isDragging && "exercise-row--dragging",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      ref={setNodeRef}
      className={className}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="exercise-row__grip"
          aria-label={`Reorder ${exercise.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>
      )}
      <Link to={to} className="exercise-row__main">
        <span className="exercise-row__status">
          {exercise.status === "done" ? (
            <span className="exercise-row__check">
              <Check size={16} strokeWidth={2.5} />
            </span>
          ) : (
            <ProgressRing
              value={
                exercise.totalSets
                  ? exercise.completedSets / exercise.totalSets
                  : 0
              }
              size={28}
              stroke={3}
            />
          )}
        </span>
        <span className="exercise-row__name">
          <VisuallyHidden>Open </VisuallyHidden>
          {exercise.name}
        </span>
        <VisuallyHidden>, {statusLabel(exercise)}</VisuallyHidden>
        <ChevronRight size={18} className="exercise-row__chevron" />
      </Link>
    </li>
  );
}
