/**
 * Measurements and measures.
 * A measurement is something you want to measure. E.g.: the weight.
 * A measure is the value of this measurement at some point in time.
 */

import { and, between, desc, eq, type InferSelectModel } from "drizzle-orm";
import { Result, ResultAsync, ok } from "neverthrow";
import { db } from "./db";
import { measurements, measures } from "./db/schema";
import {
  executeQuery,
  fetchSingleRecord,
  type ErrRepository,
  type ErrValidation,
} from "./repository";
import { addOneDay, isSameDay, removeOneDay, today } from "./time";

export interface Measurement {
  readonly name: string;
  readonly unit: string;
  readonly description?: string;
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

  save(self: Measurement) {
    return ResultAsync.fromPromise(
      db
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
      (err) => {
        console.error(err);
        return "database_error";
      },
    );
  },
};

export interface Measure {
  readonly measurementName: Measurement["name"];
  readonly value: number;
  readonly t: Date;
}

function recordToMeasure(
  record: InferSelectModel<typeof measures>,
): Result<Measure, ErrValidation> {
  return ok({
    measurementName: record.measurement_name,
    t: record.t,
    value: record.value,
  });
}

export const Measure = {
  create(measurementName: string, value: number): Measure {
    return {
      measurementName,
      value,
      t: new Date(),
    };
  },
};

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

export const MeasurementService = {
  fetchStreak(measurementName: string): ResultAsync<number, ErrRepository> {
    const thisDay = today();

    const loggedYesterday = MeasureRepository.fetchBetween(
      measurementName,
      removeOneDay(thisDay),
      addOneDay(thisDay),
    );

    return loggedYesterday.andThen((measureRecords) => {
      // No data logged yesterday: streak over
      if (measureRecords.length === 0) return ok(0);

      return MeasureRepository.fetchAll(measurementName).andThen((measures) => {
        let streak = 1;
        let lastDay = measures[0].t;
        for (const measure of measures.slice(1)) {
          if (!isSameDay(measure.t, removeOneDay(lastDay))) {
            break;
          }
          streak++;
          lastDay = measure.t;
        }
        return ok(streak);
      });
    });
  },
};
