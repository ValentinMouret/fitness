import { SegmentedControl } from "@radix-ui/themes";
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
import { chartColors } from "~/design-system";
import type { ProgressMetricViewModel } from "../../view-models/exercise-history-sheet.view-model";
import "./ExerciseProgressChart.css";

interface ExerciseProgressChartProps {
  readonly metrics: ReadonlyArray<ProgressMetricViewModel>;
}

/** Session-by-session trend of one exercise, one metric at a time. */
export function ExerciseProgressChart({ metrics }: ExerciseProgressChartProps) {
  const [selectedKey, setSelectedKey] = useState(metrics[0]?.key);
  const metric =
    metrics.find((candidate) => candidate.key === selectedKey) ?? metrics[0];
  if (!metric) return null;

  return (
    <section className="progress-chart" aria-label="Progress">
      {metrics.length > 1 && (
        <SegmentedControl.Root
          size="1"
          value={metric.key}
          onValueChange={setSelectedKey}
          className="progress-chart__metrics"
        >
          {metrics.map((candidate) => (
            <SegmentedControl.Item key={candidate.key} value={candidate.key}>
              {candidate.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      )}
      <p className="progress-chart__summary">
        <span className="progress-chart__latest">{metric.latestDisplay}</span>
        <span className="progress-chart__change">{metric.changeDisplay}</span>
      </p>
      <div className="progress-chart__plot">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart
            data={[...metric.points]}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--gray-4)" vertical={false} />
            <XAxis
              dataKey="dateDisplay"
              stroke="var(--brand-text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              stroke="var(--brand-text-secondary)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={["auto", "auto"]}
            />
            <Tooltip
              wrapperClassName="chart-tooltip"
              formatter={(value) => [`${value} ${metric.unit}`, metric.label]}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={chartColors.primary}
              strokeWidth={2}
              dot={{ fill: chartColors.primary, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
