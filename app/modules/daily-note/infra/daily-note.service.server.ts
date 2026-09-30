import type { UserId } from "~/modules/auth/domain/user";
import { createServerError } from "~/utils/errors";
import type { DailyNote } from "../domain/entity";
import { createDailyNoteRepository } from "./repository.server";

export async function getDailyNote(
  userId: UserId,
): Promise<DailyNote | undefined> {
  const result = await createDailyNoteRepository(userId).fetch();
  if (result.isErr()) {
    throw createServerError("Failed to fetch daily note", 500, result.error);
  }
  return result.value;
}

export async function saveDailyNote(
  userId: UserId,
  content: string,
): Promise<void> {
  const result = await createDailyNoteRepository(userId).save(content);
  if (result.isErr()) {
    throw createServerError("Failed to save daily note", 500, result.error);
  }
}
