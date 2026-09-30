import { and, eq, type InferSelectModel } from "drizzle-orm";
import { ok, Result, ResultAsync } from "neverthrow";
import { db } from "~/db/index";
import { measurements } from "~/db/schema";
import { logger } from "~/logger.server";
import type { UserId } from "~/modules/auth/domain/user";
import type { ErrRepository, ErrValidation } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import type { Measurement } from "../domain/measurements";

export function createMeasurementRepository(userId: UserId, database = db) {
  return {
    fetchByName(name: string): ResultAsync<Measurement, ErrRepository> {
      const query = database
        .select()
        .from(measurements)
        .where(
          and(eq(measurements.userId, userId), eq(measurements.name, name)),
        )
        .limit(1);

      return executeQuery(query, "fetchByName")
        .andThen(fetchSingleRecord)
        .andThen((record) => recordToMeasurement(record));
    },

    fetchAll(): ResultAsync<Measurement[], ErrRepository> {
      const query = database
        .select()
        .from(measurements)
        .where(eq(measurements.userId, userId));

      return executeQuery(query, "fetchAll").andThen((records) =>
        Result.combine(records.map(recordToMeasurement)),
      );
    },

    save(self: Measurement, tx?: Transaction) {
      return ResultAsync.fromPromise(
        (tx ?? database)
          .insert(measurements)
          .values({ ...self, userId })
          .onConflictDoUpdate({
            target: [measurements.userId, measurements.name],
            set: {
              updated_at: new Date(),
              description: self.description,
              unit: self.unit,
            },
          }),
        (error) => {
          logger.error({ err: error }, "Failed to save measurement");
          return "database_error";
        },
      );
    },
  };
}

function recordToMeasurement(
  record: InferSelectModel<typeof measurements>,
): Result<Measurement, ErrValidation> {
  return ok({
    name: record.name,
    unit: record.unit,
    description: record.description ?? undefined,
  });
}
