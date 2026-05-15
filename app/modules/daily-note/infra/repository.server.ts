import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import { daily_note } from "~/db/schema";
import { logger } from "~/logger.server";
import type { DailyNote } from "../domain/entity";

const SINGLETON_ID = 1;

export const DailyNoteRepository = {
  fetch(): ResultAsync<DailyNote | undefined, Error> {
    return ResultAsync.fromPromise(
      db
        .select()
        .from(daily_note)
        .where(eq(daily_note.id, SINGLETON_ID))
        .then((rows) => (rows[0] ? { content: rows[0].content } : undefined)),
      (error) => {
        logger.error({ err: error }, "Failed to fetch daily note");
        return error as Error;
      },
    );
  },

  save(content: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      db
        .insert(daily_note)
        .values({ id: SINGLETON_ID, content, updated_at: new Date() })
        .onConflictDoUpdate({
          target: daily_note.id,
          set: { content, updated_at: new Date() },
        })
        .then(() => undefined),
      (error) => {
        logger.error({ err: error }, "Failed to save daily note");
        return error as Error;
      },
    );
  },
};
