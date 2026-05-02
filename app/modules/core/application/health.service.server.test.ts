import { errAsync, okAsync } from "neverthrow";
import {
  type DatabaseHealthCheck,
  getHealthReport,
} from "./health.service.server";

const healthyDatabaseCheck: DatabaseHealthCheck = () => okAsync(undefined);
const unhealthyDatabaseCheck: DatabaseHealthCheck = () =>
  errAsync(new Error("database unavailable"));

describe("getHealthReport", () => {
  it("returns ok when the database check succeeds", async () => {
    const report = await getHealthReport({
      sha: "abc123",
      checkDatabase: healthyDatabaseCheck,
    });

    expect(report).toEqual({
      status: "ok",
      sha: "abc123",
      checks: {
        database: "ok",
      },
    });
  });

  it("returns unhealthy when the database check fails", async () => {
    const report = await getHealthReport({
      sha: "abc123",
      checkDatabase: unhealthyDatabaseCheck,
    });

    expect(report).toEqual({
      status: "unhealthy",
      sha: "abc123",
      checks: {
        database: "unhealthy",
      },
    });
  });
});
