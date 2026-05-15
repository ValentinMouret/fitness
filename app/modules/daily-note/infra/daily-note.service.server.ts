import { createServerError } from "~/utils/errors";
import type { DailyNote } from "../domain/entity";
import { DailyNoteRepository } from "./repository.server";

export async function getDailyNote(): Promise<DailyNote | undefined> {
  const result = await DailyNoteRepository.fetch();
  if (result.isErr()) {
    throw createServerError("Failed to fetch daily note", 500, result.error);
  }
  return result.value;
}

export async function saveDailyNote(content: string): Promise<void> {
  const result = await DailyNoteRepository.save(content);
  if (result.isErr()) {
    throw createServerError("Failed to save daily note", 500, result.error);
  }
}
