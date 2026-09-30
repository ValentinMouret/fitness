import type { UserId } from "~/modules/auth/domain/user";
import { type Habit, Habit as HabitEntity } from "../domain/entity";
import { createHabitRepositories } from "./repository.server";

export type CreateHabitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function createHabit(
  userId: UserId,
  input: {
    readonly name: string;
    readonly identityPhrase: string;
    readonly timeOfDay: string;
    readonly location: string;
    readonly isKeystone: boolean;
    readonly minimalVersion: string;
    readonly color: string;
    readonly frequencyType: Habit["frequencyType"];
    readonly frequencyConfig: Habit["frequencyConfig"];
  },
): Promise<CreateHabitResult> {
  const repositories = createHabitRepositories(userId);
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

  const result = await repositories.habits.save(habit);

  if (result.isErr()) {
    return { ok: false, error: "Failed to create habit", status: 500 };
  }

  return { ok: true };
}
