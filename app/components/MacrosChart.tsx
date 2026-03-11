import { Flex, Text } from "@radix-ui/themes";
import { useId } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartColors } from "~/design-system";
import "./MacrosChart.css";

interface MacrosChartData {
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

interface MacrosChartProps {
  readonly macrosSplit: MacrosChartData;
}

const MACROS_ENERGY_PER_GRAM = {
  protein: 4,
  fat: 9,
  carbs: 4,
} as const;

const COLORS = {
  protein: chartColors.protein,
  fat: chartColors.fat,
  carbs: chartColors.carbs,
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      grams: number;
      calories: number;
      color: string;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <Text weight="medium" size="2" style={{ color: data.color }}>
          {data.name}
        </Text>
        <div className="macros-chart__tooltip-body">
          <Text size="1" color="gray" className="d-block">
            {data.grams}g · {Math.round(data.calories)} kcal
          </Text>
        </div>
      </div>
    );
  }
  return null;
};

export default function MacrosChart({ macrosSplit }: MacrosChartProps) {
  const glowId = useId();
  const data = [
    {
      name: "Protein",
      grams: macrosSplit.protein,
      calories: macrosSplit.protein * MACROS_ENERGY_PER_GRAM.protein,
      color: COLORS.protein,
    },
    {
      name: "Fat",
      grams: macrosSplit.fat,
      calories: macrosSplit.fat * MACROS_ENERGY_PER_GRAM.fat,
      color: COLORS.fat,
    },
    {
      name: "Carbs",
      grams: macrosSplit.carbs,
      calories: macrosSplit.carbs * MACROS_ENERGY_PER_GRAM.carbs,
      color: COLORS.carbs,
    },
  ];

  return (
    <div className="macros-chart-container">
      <div className="macros-chart__canvas">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <defs>
              <filter id={glowId}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={115}
              paddingAngle={3}
              dataKey="calories"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  filter={`url(#${glowId})`}
                  fillOpacity={0.9}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Flex
        className="macros-legend macros-chart__legend"
        direction="column"
        gap="3"
        justify="center"
      >
        {data.map((entry) => (
          <Flex key={entry.name} direction="column" gap="1">
            <Flex align="center" gap="2">
              <div
                className="macros-chart__legend-swatch"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 2px 4px ${entry.color}40`,
                }}
              />
              <Text size="2" weight="medium">
                {entry.name}
              </Text>
            </Flex>
            <Text size="1" color="gray" className="macros-chart__legend-detail">
              {entry.grams}g · {Math.round(entry.calories)} kcal
            </Text>
          </Flex>
        ))}
      </Flex>
    </div>
  );
}
