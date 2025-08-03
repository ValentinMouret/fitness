import { Flex, Text } from "@radix-ui/themes";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { macrosEnergyPerGram } from "~/modules/nutrition/domain/macros";
import type { MacrosSplit } from "~/modules/nutrition/domain/nutrition-calculation-service";

interface MacrosChartProps {
  readonly macrosSplit: MacrosSplit;
}

const COLORS = {
  protein: "#e53e3e",
  fat: "#ffd43b",
  carbs: "#868e96",
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
          backgroundColor: "white",
          padding: "12px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <Text weight="medium" size="2" style={{ color: data.color }}>
          {data.name}
        </Text>
        <div style={{ marginTop: "4px" }}>
          <Text size="1" style={{ display: "block" }}>
            {data.grams}g/day
          </Text>
          <Text size="1" style={{ display: "block" }}>
            {Math.round(data.calories)}kcal/day
          </Text>
        </div>
      </div>
    );
  }
  return null;
};

export default function MacrosChart({ macrosSplit }: MacrosChartProps) {
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
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={2}
              dataKey="calories"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Flex direction="column" gap="3" style={{ minWidth: "120px" }}>
        {data.map((entry) => (
          <Flex key={entry.name} direction="column" gap="1">
            <Flex align="center" gap="2">
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: entry.color,
                  borderRadius: "2px",
                }}
              />
              <Text size="2" weight="medium">
                {entry.name}
              </Text>
            </Flex>
            <Text size="1" color="gray" style={{ marginLeft: "20px" }}>
              {entry.grams}g/day
            </Text>
            <Text size="1" color="gray" style={{ marginLeft: "20px" }}>
              {Math.round(entry.calories)}kcal/day
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
