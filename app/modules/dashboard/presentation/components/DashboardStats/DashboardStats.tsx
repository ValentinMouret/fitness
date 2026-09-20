import type { DashboardStatViewModel } from "../../view-models/dashboard-stats.view-model";
import "./DashboardStats.css";

export function DashboardStats({
  stats,
}: {
  readonly stats: readonly DashboardStatViewModel[];
}) {
  return (
    <section className="dashboard-stats" aria-label="Daily stats">
      {stats.map((stat) => (
        <dl
          className="dashboard-stats__cell"
          aria-label={stat.name}
          key={stat.name}
        >
          <dt className="dashboard-stats__unit">{stat.unit}</dt>
          <dd className="dashboard-stats__value">{stat.value}</dd>
          <dd className="dashboard-stats__target">
            {stat.target === null ? "/ —" : `/ ${stat.target}`}
          </dd>
          <dd className="dashboard-stats__progress-space">
            {stat.progress !== null && (
              <div
                className="dashboard-stats__progress"
                role="progressbar"
                aria-valuenow={stat.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Daily ${stat.name.toLowerCase()} progress`}
                aria-valuetext={stat.accessibleValue}
              >
                <div
                  className="dashboard-stats__fill"
                  style={{ width: `${stat.progress}%` }}
                />
              </div>
            )}
          </dd>
          <dd className="dashboard-stats__detail">{stat.detail}</dd>
        </dl>
      ))}
    </section>
  );
}
