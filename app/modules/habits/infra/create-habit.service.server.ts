import { type Habit, Habit as HabitEntity } from "../domain/entity";
import { HabitRepository } from "./repository.server";

export type CreateHabitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function createHabit(input: {
  readonly name: string;
  readonly identityPhrase: string;
  readonly timeOfDay: string;
  readonly location: string;
  readonly isKeystone: boolean;
  readonly minimalVersion: string;
  readonly color: string;
  readonly frequencyType: Habit["frequencyType"];
  readonly frequencyConfig: Habit["frequencyConfig"];
}): Promise<CreateHabitResult> {
  const habit = HabitEntity.create(
    input.name,
    input.frequencyType,
    input.frequencyConfig,
    {
      identityPhrase: input.identityPhrase,
      timeOfDay: input.timeOfDay,
      location: input.location,
      isKeystone: input.isKeystone,
      minimalVersion: input.minimalVersion,
      color: input.color,
    },
  );

  const result = await HabitRepository.save(habit);

  if (result.isErr()) {
    return { ok: false, error: "Failed to create habit", status: 500 };
  }

  return { ok: true };
}
