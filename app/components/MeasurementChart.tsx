import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Measure } from "~/modules/core/domain/measure";
import "./WeightChart.css";

export type TimePeriod = "week" | "month" | "3months";

interface MeasurementChartProps {
  readonly data: readonly Measure[];
  readonly unit: string;
  readonly measurementName: string;
}

export default function MeasurementChart({
  data,
  unit,
  measurementName,
}: MeasurementChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("month");

  const filterDataByPeriod = (period: TimePeriod) => {
    const now = new Date();
    const cutoffDate = new Date(now);

    switch (period) {
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "3months":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
    }

    return data.filter((measure) => measure.t >= cutoffDate);
  };

  const filteredData = filterDataByPeriod(selectedPeriod);

  const chartData = filteredData
    .map((measure) => ({
      timestamp: measure.t.getTime(),
      value: measure.value,
      fullDate: measure.t.toLocaleDateString(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const displayName = measurementName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  if (chartData.length === 0) {
    return (
      <div className="weight-chart">
        <div className="weight-chart-header">
          <h3>{displayName} Evolution</h3>
          <div className="period-selector">
            <button
              type="button"
              className={selectedPeriod === "week" ? "active" : ""}
              onClick={() => setSelectedPeriod("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={selectedPeriod === "month" ? "active" : ""}
              onClick={() => setSelectedPeriod("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={selectedPeriod === "3months" ? "active" : ""}
              onClick={() => setSelectedPeriod("3months")}
            >
              3 Months
            </button>
          </div>
        </div>
        <div className="weight-chart-empty">
          <p>
            No {measurementName.replace(/_/g, " ")} data available for the
            selected period.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="weight-chart">
      <div className="weight-chart-header">
        <h3>{displayName} Evolution</h3>
        <div className="period-selector">
          <button
            type="button"
            className={selectedPeriod === "week" ? "active" : ""}
            onClick={() => setSelectedPeriod("week")}
          >
            Week
          </button>
          <button
            type="button"
            className={selectedPeriod === "month" ? "active" : ""}
            onClick={() => setSelectedPeriod("month")}
          >
            Month
          </button>
          <button
            type="button"
            className={selectedPeriod === "3months" ? "active" : ""}
            onClick={() => setSelectedPeriod("3months")}
          >
            3 Months
          </button>
        </div>
      </div>
      <div className="weight-chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--gray-4, #e5e5e5)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
              stroke="var(--brand-text-secondary, #79756d)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={["dataMin - 1", "dataMax + 1"]}
              stroke="var(--brand-text-secondary, #79756d)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: `${displayName} (${unit})`,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "var(--brand-text-secondary, #79756d)",
                },
              }}
            />
            <Tooltip
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              formatter={(value) => [`${value} ${unit}`, displayName]}
              wrapperClassName="chart-tooltip"
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="#e15a46"
              strokeWidth={2.5}
              dot={{ fill: "#e15a46", strokeWidth: 0, r: 4 }}
              activeDot={{
                r: 6,
                fill: "#e15a46",
                strokeWidth: 3,
                stroke: "white",
                style: {
                  filter: "drop-shadow(0 2px 4px rgba(225, 90, 70, 0.3))",
                },
              }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
