import { handleResultError } from "~/utils/errors";
import type { Habit } from "../domain/entity";
import { HabitRepository } from "../infra/repository.server";

export async function getHabitForEdit(id: string): Promise<Habit> {
  const result = await HabitRepository.fetchById(id);

  if (result.isErr()) {
    handleResultError(result, "Habit not found", 404);
  }

  return result.value;
}

export type UpdateHabitResult =
  | { readonly ok: true; readonly habit: Habit }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function updateHabit(input: {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly frequencyType: Habit["frequencyType"];
  readonly frequencyConfig: Habit["frequencyConfig"];
}): Promise<UpdateHabitResult> {
  const existingHabit = await HabitRepository.fetchById(input.id);
  if (existingHabit.isErr()) {
    return { ok: false, error: "Habit not found", status: 404 };
  }

  const updatedHabit: Habit = {
    ...existingHabit.value,
    name: input.name,
    description: input.description,
    frequencyType: input.frequencyType,
    frequencyConfig: input.frequencyConfig,
  };

  const result = await HabitRepository.save(updatedHabit);

  if (result.isErr()) {
    return { ok: false, error: "Failed to update habit", status: 500 };
  }

  return { ok: true, habit: updatedHabit };
}
