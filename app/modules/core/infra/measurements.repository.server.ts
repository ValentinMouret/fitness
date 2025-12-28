import { eq, type InferSelectModel } from "drizzle-orm";
import { Result, ResultAsync, ok } from "neverthrow";
import { db } from "~/db/index";
import { measurements } from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository, ErrValidation } from "~/repository";
import {
  executeQuery,
  fetchSingleRecord,
  type Transaction,
} from "~/repository.server";
import type { Measurement } from "../domain/measurements";

export const MeasurementRepository = {
  fetchByName(name: string): ResultAsync<Measurement, ErrRepository> {
    const query = db
      .select()
      .from(measurements)
      .where(eq(measurements.name, name))
      .limit(1);

    return executeQuery(query, "fetchByName")
      .andThen(fetchSingleRecord)
      .andThen((record) => recordToMeasurement(record));
  },

  fetchAll(): ResultAsync<Measurement[], ErrRepository> {
    const query = db.select().from(measurements);

    return executeQuery(query, "fetchAll").andThen((records) =>
      Result.combine(records.map(recordToMeasurement)),
    );
  },

  save(self: Measurement, tx?: Transaction) {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .insert(measurements)
        .values(self)
        .onConflictDoUpdate({
          target: measurements.name,
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

function recordToMeasurement(
  record: InferSelectModel<typeof measurements>,
): Result<Measurement, ErrValidation> {
  return ok({
    name: record.name,
    unit: record.unit,
    description: record.description ?? undefined,
  });
}
