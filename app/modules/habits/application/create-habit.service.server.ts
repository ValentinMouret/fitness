import { Habit as HabitEntity, type Habit } from "../domain/entity";
import { HabitRepository } from "../infra/repository.server";

export type CreateHabitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function createHabit(input: {
  readonly name: string;
  readonly description?: string;
  readonly frequencyType: Habit["frequencyType"];
  readonly frequencyConfig: Habit["frequencyConfig"];
}): Promise<CreateHabitResult> {
  const habit = HabitEntity.create(
    input.name,
    input.frequencyType,
    input.frequencyConfig,
    {
      description: input.description,
    },
  );

  const result = await HabitRepository.save(habit);

  if (result.isErr()) {
    return { ok: false, error: "Failed to create habit", status: 500 };
  }

  return { ok: true };
}
