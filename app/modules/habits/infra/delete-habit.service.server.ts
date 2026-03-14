import { HabitRepository } from "./repository.server";

export type DeleteHabitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function deleteHabit(id: string): Promise<DeleteHabitResult> {
  const result = await HabitRepository.delete(id);

  if (result.isErr()) {
    if (result.error === "not_found") {
      return { ok: false, error: "Habit not found", status: 404 };
    }

    return { ok: false, error: "Failed to delete habit", status: 500 };
  }

  return { ok: true };
}
