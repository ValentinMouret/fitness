import {
  and,
  eq,
  type InferSelectModel,
  isNull,
  sql,
  TransactionRollbackError,
} from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { measurements, targets } from "~/db/schema";
import { logger } from "~/logger.server";
import type { UserId } from "~/modules/auth/domain/user";
import type { ErrValidation } from "~/repository";
import { executeQuery } from "~/repository.server";
import type { Target } from "../domain/target";

export function createTargetRepository(
  userId: UserId,
  database: Pick<typeof db, "select" | "transaction"> = db,
) {
  return {
    set(target: Target) {
      return ResultAsync.fromPromise(
        database.transaction(async (tx) => {
          const [measurement] = await tx
            .select({ name: measurements.name })
            .from(measurements)
            .where(
              and(
                eq(measurements.userId, userId),
                eq(measurements.name, target.measurement),
              ),
            )
            .for("update");
          if (!measurement) return err("not_found" as const);
          await tx
            .update(targets)
            .set({ deleted_at: sql`current_timestamp` })
            .where(
              and(
                eq(targets.userId, userId),
                eq(targets.measurement_name, target.measurement),
                isNull(targets.deleted_at),
              ),
            );
          const [record] = await tx
            .insert(targets)
            .values({
              userId,
              id: target.id,
              measurement_name: target.measurement,
              value: target.value,
            })
            .onConflictDoUpdate({
              target: targets.id,
              set: {
                measurement_name: target.measurement,
                value: target.value,
                deleted_at: null,
              },
              setWhere: eq(targets.userId, userId),
            })
            .returning();
          if (!record) tx.rollback();
          return recordToDomain(record);
        }),
        (error) => {
          if (error instanceof TransactionRollbackError)
            return "not_found" as const;
          logger.error({ err: error }, "Failed to set target");
          return "database_error" as const;
        },
      ).andThen((result) => result);
    },

    listAllActive() {
      const query = database
        .select()
        .from(targets)
        .where(and(eq(targets.userId, userId), isNull(targets.deleted_at)));
      return executeQuery(query, "listAllActive").andThen((records) =>
        Result.combine(records.map(recordToDomain)),
      );
    },
  };
}

function recordToDomain(
  record: InferSelectModel<typeof targets>,
): Result<Target, ErrValidation> {
  return ok({
    id: record.id,
    measurement: record.measurement_name,
    value: record.value,
  });
}
