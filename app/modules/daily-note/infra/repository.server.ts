import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import { daily_note } from "~/db/schema";
import { UnknownError } from "~/errors";
import { logger } from "~/logger.server";
import type { UserId } from "~/modules/auth/domain/user";
import type { DailyNote } from "../domain/entity";

const SINGLETON_ID = 1;

export function createDailyNoteRepository(userId: UserId, database = db) {
  return {
    fetch(): ResultAsync<DailyNote | undefined, Error> {
      return ResultAsync.fromPromise(
        database
          .select()
          .from(daily_note)
          .where(
            and(eq(daily_note.userId, userId), eq(daily_note.id, SINGLETON_ID)),
          )
          .then((rows) => (rows[0] ? { content: rows[0].content } : undefined)),
        (error) => {
          logger.error({ err: error }, "Failed to fetch daily note");
          return error instanceof Error ? error : new UnknownError(error);
        },
      );
    },

    save(content: string): ResultAsync<void, Error> {
      return ResultAsync.fromPromise(
        database
          .insert(daily_note)
          .values({ userId, id: SINGLETON_ID, content, updated_at: new Date() })
          .onConflictDoUpdate({
            target: [daily_note.userId, daily_note.id],
            set: { content, updated_at: new Date() },
          })
          .then(() => undefined),
        (error) => {
          logger.error({ err: error }, "Failed to save daily note");
          return error instanceof Error ? error : new UnknownError(error);
        },
      );
    },
  };
}
