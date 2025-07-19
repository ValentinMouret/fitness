import { and, between, desc, eq, type InferSelectModel } from "drizzle-orm";
import { Result, ResultAsync, ok } from "neverthrow";
import { db } from "~/db/index";
import { measures } from "~/db/schema";
import type { ErrRepository, ErrValidation } from "~/repository";
import { executeQuery } from "~/repository.server";
import type { Measure } from "../domain/measure";

export const MeasureRepository = {
  save(self: Measure) {
    return ResultAsync.fromPromise(
      db
        .insert(measures)
        .values({
          measurement_name: self.measurementName,
          value: self.value,
          t: self.t,
        })
        .onConflictDoUpdate({
          target: [measures.measurement_name, measures.t],
          set: {
            value: self.value,
          },
        }),
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },

  fetchByMeasurementName(
    measurementName: string,
    last = 25,
  ): ResultAsync<Measure[], ErrRepository> {
    const query = db
      .select()
      .from(measures)
      .where(eq(measures.measurement_name, measurementName))
      .orderBy(desc(measures.t))
      .limit(last);

    return executeQuery(query, "fetchByMeasurementName").andThen((records) =>
      Result.combine(records.map(recordToMeasure)),
    );
  },

  fetchBetween(
    measurementName: string,
    from: Date,
    to: Date,
  ): ResultAsync<Measure[], ErrRepository> {
    const query = db
      .select()
      .from(measures)
      .where(
        and(
          eq(measures.measurement_name, measurementName),
          between(measures.t, from, to),
        ),
      );
    const results = executeQuery(query, "fetchBetween");
    return results.andThen((records) =>
      Result.combine(records.map(recordToMeasure)),
    );
  },

  fetchAll(measurementName: string): ResultAsync<Measure[], ErrRepository> {
    const query = db
      .select()
      .from(measures)
      .where(eq(measures.measurement_name, measurementName))
      .orderBy(desc(measures.t));

    return executeQuery(query, "fetch_all").andThen((records) =>
      Result.combine(records.map(recordToMeasure)),
    );
  },
};

function recordToMeasure(
  record: InferSelectModel<typeof measures>,
): Result<Measure, ErrValidation> {
  return ok({
    measurementName: record.measurement_name,
    t: record.t,
    value: record.value,
  });
}
