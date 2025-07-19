import { db } from "~/db";
import type { Target } from "../domain/target";
import { targets } from "~/db/schema";
import { ok, Result, ResultAsync } from "neverthrow";
import {
  eq,
  isNull,
  sql,
  type InferInsertModel,
  type InferSelectModel,
} from "drizzle-orm";
import type { ErrValidation } from "~/repository";
import { executeQuery, type Transaction } from "~/repository.server";

export const TargetRepository = {
  save(target: Target, tx?: Transaction) {
    const values: InferInsertModel<typeof targets> = {
      id: target.id,
      measurement_name: target.measurement,
      value: target.value,
    };
    return ResultAsync.fromPromise(
      (tx ?? db)
        .insert(targets)
        .values(values)
        .onConflictDoUpdate({
          target: targets.id,
          set: {
            measurement_name: values.measurement_name,
            value: values.value,
          },
        })
        .returning(),
      (err) => {
        console.error(err);
        return "database_error" as const;
      },
    ).andThen((record) => recordToDomain(record[0]));
  },

  listAllActive() {
    const query = db.select().from(targets).where(isNull(targets.deleted_at));
    return executeQuery(query, "listAllActive").andThen((records) =>
      Result.combine(records.map(recordToDomain)),
    );
  },

  unsetTargetsByName(measurement: string, tx?: Transaction) {
    return ResultAsync.fromPromise(
      (tx ?? db)
        .update(targets)
        .set({
          deleted_at: sql`current_timestamp`,
        })
        .where(eq(targets.measurement_name, measurement)),
      (err) => {
        console.error(err);
        return "database_error" as const;
      },
    );
  },
};

function recordToDomain(
  record: InferSelectModel<typeof targets>,
): Result<Target, ErrValidation> {
  return ok({
    id: record.id,
    measurement: record.measurement_name,
    value: record.value,
  });
}
