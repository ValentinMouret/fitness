export type HealthStatus = "ok" | "unhealthy";

export type HealthCheckName = "database";

export type HealthReport = {
  readonly status: HealthStatus;
  readonly sha: string;
  readonly checks: Readonly<Record<HealthCheckName, HealthStatus>>;
};

export const createHealthReport = ({
  sha,
  database,
}: {
  readonly sha: string;
  readonly database: HealthStatus;
}): HealthReport => ({
  status: database === "ok" ? "ok" : "unhealthy",
  sha,
  checks: {
    database,
  },
});
