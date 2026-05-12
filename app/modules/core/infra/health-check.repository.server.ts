import { sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import type { DatabaseHealthCheck } from "~/modules/core/application/health.service.server";

export const checkDatabaseHealth: DatabaseHealthCheck = () =>
  ResultAsync.fromPromise(
    db.execute(sql`select 1`).then(() => undefined),
    (error) => (error instanceof Error ? error : new Error("database error")),
  );
