import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { db } from "./db";

export type ErrDatabase = "database_error";
export type ErrNotFound = "not_found";
export type ErrValidation = "validation_error";

export type ErrRepository = ErrDatabase | ErrNotFound | ErrValidation;

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const executeQuery = <T>(
  queryPromise: Promise<T>,
  operation: string,
): ResultAsync<T, ErrDatabase> => {
  return ResultAsync.fromPromise(queryPromise, (err): ErrDatabase => {
    console.error(`Database error in ${operation}:`, err);
    return "database_error";
  });
};

export const fetchSingleRecord = <T>(records: T[]): Result<T, ErrNotFound> => {
  if (records.length === 0) {
    return err("not_found");
  }
  return ok(records[0]);
};
