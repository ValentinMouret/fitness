import type { ResultAsync } from "neverthrow";
import {
  createHealthReport,
  type HealthReport,
} from "~/modules/core/domain/health";

export type DatabaseHealthCheck = () => ResultAsync<void, Error>;

export async function getHealthReport({
  sha,
  checkDatabase,
}: {
  readonly sha: string;
  readonly checkDatabase: DatabaseHealthCheck;
}): Promise<HealthReport> {
  const database = await checkDatabase();

  return createHealthReport({
    sha,
    database: database.isOk() ? "ok" : "unhealthy",
  });
}
