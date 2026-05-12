import { env } from "~/env.server";
import { logger } from "~/logger.server";
import { getHealthReport } from "~/modules/core/application/health.service.server";
import { checkDatabaseHealth } from "~/modules/core/infra/health-check.repository.server";

export async function loader() {
  const report = await getHealthReport({
    sha: env.GIT_SHA ?? "unknown",
    checkDatabase: checkDatabaseHealth,
  });

  if (report.status === "unhealthy") {
    logger.warn({ health: report }, "health check failed");
  }

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
