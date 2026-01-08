import { useId } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { macrosEnergyPerGram } from "~/modules/nutrition/domain/macros";
import type { MacrosSplit } from "~/modules/nutrition/domain/nutrition-calculation-service";
import { chartColors } from "~/design-system";

interface MacrosChartProps {
  readonly macrosSplit: MacrosSplit;
}

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
      <div
        style={{
          backgroundColor: "#fffbf5",
          padding: "12px 16px",
          border: "1px solid var(--gray-4)",
          borderRadius: "12px",
          boxShadow: "0 4px 16px rgba(120, 80, 60, 0.12)",
        }}
      >
        <Text weight="medium" size="2" style={{ color: data.color }}>
          {data.name}
        </Text>
        <div style={{ marginTop: "6px" }}>
          <Text size="1" color="gray" style={{ display: "block" }}>
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
      calories: macrosSplit.protein * macrosEnergyPerGram.protein,
      color: COLORS.protein,
    },
    {
      name: "Fat",
      grams: macrosSplit.fat,
      calories: macrosSplit.fat * macrosEnergyPerGram.fat,
      color: COLORS.fat,
    },
    {
      name: "Carbs",
      grams: macrosSplit.carbs,
      calories: macrosSplit.carbs * macrosEnergyPerGram.carbs,
      color: COLORS.carbs,
    },
  ];

  return (
    <Flex gap="4">
      <div style={{ flex: 1 }}>
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
                  style={{ filter: `url(#${glowId})`, opacity: 0.9 }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Flex
        direction="column"
        gap="3"
        justify="center"
        style={{ minWidth: "120px" }}
      >
        {data.map((entry) => (
          <Flex key={entry.name} direction="column" gap="1">
            <Flex align="center" gap="2">
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  backgroundColor: entry.color,
                  borderRadius: "4px",
                  boxShadow: `0 2px 4px ${entry.color}40`,
                }}
              />
              <Text size="2" weight="medium">
                {entry.name}
              </Text>
            </Flex>
            <Text size="1" color="gray" style={{ marginLeft: "22px" }}>
              {entry.grams}g · {Math.round(entry.calories)} kcal
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
