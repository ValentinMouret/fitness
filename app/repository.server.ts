import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { db } from "./db";
import { logger } from "./logger.server";
import type { ErrDatabase, ErrNotFound } from "./repository";
import { isNotEmpty } from "./utils/types";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const executeQuery = <T>(
  queryPromise: Promise<T>,
  operation: string,
): ResultAsync<T, ErrDatabase> => {
  return ResultAsync.fromPromise(queryPromise, (error): ErrDatabase => {
    logger.error({ err: error, operation }, "Database error");
    return "database_error";
  });
};

export const fetchSingleRecord = <T>(records: T[]): Result<T, ErrNotFound> => {
  if (!isNotEmpty(records)) {
    return err("not_found");
  }
  return ok(records[0]);
};
