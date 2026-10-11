import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { reorderIds } from "../../reorder-ids";
import type { ActiveExerciseViewModel } from "../../view-models/active-workout.view-model";
import { ExerciseProgressRow } from "./ExerciseProgressRow";
import "./ExerciseProgressList.css";

interface ExerciseProgressListProps {
  readonly exercises: ReadonlyArray<ActiveExerciseViewModel>;
  readonly linkTo: (exerciseId: string) => string;
  /** Enables dragging rows to reorder; absent for a finished workout. */
  readonly onReorder?: (exerciseIds: ReadonlyArray<string>) => void;
}

/** The workout's exercises with their progress, in training order. */
export function ExerciseProgressList({
  exercises,
  linkTo,
  onReorder,
}: ExerciseProgressListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const ids = exercises.map((exercise) => exercise.id);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const reordered = reorderIds(ids, String(active.id), String(over.id));
    if (reordered) onReorder?.(reordered);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="exercise-list">
          {exercises.map((exercise) => (
            <ExerciseProgressRow
              key={exercise.id}
              exercise={exercise}
              to={linkTo(exercise.id)}
              sortable={onReorder !== undefined}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
