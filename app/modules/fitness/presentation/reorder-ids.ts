/** Moves `activeId` to the position of `overId`; null when nothing moves. */
export function reorderIds(
  ids: ReadonlyArray<string>,
  activeId: string,
  overId: string,
): ReadonlyArray<string> | null {
  if (activeId === overId) return null;

  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return null;

  const reordered = [...ids];
  reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, activeId);
  return reordered;
}
