import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Measure } from "~/measurements";
import "./WeightChart.css";

export type TimePeriod = "week" | "month" | "3months";

interface WeightChartProps {
  readonly data: readonly Measure[];
  readonly unit: string;
}

export default function WeightChart({ data, unit }: WeightChartProps) {
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
      date: measure.t.toISOString().split("T")[0],
      weight: measure.value,
      fullDate: measure.t.toLocaleDateString(),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (chartData.length === 0) {
    return (
      <div className="weight-chart">
        <div className="weight-chart-header">
          <h3>Weight Evolution</h3>
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
          <p>No weight data available for the selected period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weight-chart">
      <div className="weight-chart-header">
        <h3>Weight Evolution</h3>
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
              strokeDasharray="2 2"
              stroke="#f0f0f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
              stroke="#999"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={["dataMin - 1", "dataMax + 1"]}
              stroke="#999"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: `Weight (${unit})`,
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle", fill: "#666" },
              }}
            />
            <Tooltip
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              formatter={(value: number) => [`${value} ${unit}`, "Weight"]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            />
            <Line
              type="linear"
              dataKey="weight"
              stroke="#333"
              strokeWidth={2}
              dot={{ fill: "#333", strokeWidth: 0, r: 3 }}
              activeDot={{
                r: 5,
                fill: "#333",
                strokeWidth: 2,
                stroke: "white",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
