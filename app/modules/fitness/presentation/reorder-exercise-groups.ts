import type { WorkoutExerciseGroup } from "~/modules/fitness/domain/workout";

/** Reorders exercise groups by moving the item at oldId to the position of newId. */
export function reorderExerciseGroups(
  groups: ReadonlyArray<WorkoutExerciseGroup>,
  activeId: string,
  overId: string,
): ReadonlyArray<WorkoutExerciseGroup> | null {
  if (activeId === overId) return null;

  const oldIndex = groups.findIndex((g) => g.exercise.id === activeId);
  const newIndex = groups.findIndex((g) => g.exercise.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  const reordered = [...groups];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  return reordered;
}
