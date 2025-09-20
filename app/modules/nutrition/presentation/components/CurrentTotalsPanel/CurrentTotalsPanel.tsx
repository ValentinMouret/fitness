import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { Objectives } from "../ObjectivesPanel";

export interface NutritionTotals {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber: number;
  readonly volume: number;
}

interface CurrentTotalsPanelProps {
  readonly objectives: Objectives;
  readonly totals: NutritionTotals;
  readonly satietyScore: number;
  readonly satietyDuration: string;
}

const getProgress = (current: number, target: number | null) => {
  if (!target) return 0;
  return (current / target) * 100;
};

const getProgressColor = (current: number, target: number | null) => {
  if (!target) return "var(--gray-6)";
  const percentage = (current / target) * 100;
  if (percentage < 33) return "var(--red-9)";
  if (percentage < 66) return "var(--yellow-9)";
  if (percentage <= 120) return "var(--green-9)";
  return "var(--red-9)"; // Over 120% shows red
};

const formatProgress = (current: number, target: number | null) => {
  if (!target) return `${Math.round(current)}`;
  return `${Math.round(current)}/${target}`;
};

const MacroProgressBar = ({
  current,
  target,
  label,
  unit,
  size = "normal",
}: {
  readonly current: number;
  readonly target: number | null;
  readonly label: string;
  readonly unit: string;
  readonly size?: "normal" | "large";
}) => {
  const progress = target ? getProgress(current, target) : 0;
  const color = target ? getProgressColor(current, target) : "var(--blue-9)";

  // For visual display: if no target, show current value as a proportion of a reasonable max
  // Use different reasonable maxes for different macros
  const getReasonableMax = () => {
    if (label === "Calories") return 3000;
    if (label === "Protein") return 200;
    if (label === "Carbs") return 400;
    if (label === "Fats") return 150;
    return 100;
  };

  const displayProgress = target
    ? Math.min(progress, 120)
    : Math.min((current / getReasonableMax()) * 100, 100); // Show current value as % of reasonable max

  return (
    <Box>
      <Flex justify="between" mb="1">
        <Text
          size={size === "large" ? "3" : "2"}
          weight={size === "large" ? "medium" : "regular"}
        >
          {label}:{" "}
          {target ? formatProgress(current, target) : Math.round(current)}{" "}
          {unit}
        </Text>
        {target && <Text size="2">{Math.round(progress)}%</Text>}
      </Flex>
      <Box
        style={{
          position: "relative",
          width: "100%",
          height: size === "large" ? "12px" : "8px",
          backgroundColor: "var(--gray-4)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${displayProgress}%`,
            backgroundColor: color,
            borderRadius: "6px",
            transition: "width 0.3s ease, background-color 0.3s ease",
          }}
        />
      </Box>
    </Box>
  );
};

export function CurrentTotalsPanel({
  objectives,
  totals,
  satietyScore,
  satietyDuration,
}: CurrentTotalsPanelProps) {
  return (
    <Card size="3">
      <Heading size="4" mb="3">
        Current Totals
      </Heading>

      <Flex direction="column" gap="3">
        <MacroProgressBar
          current={totals.calories}
          target={objectives.calories}
          label="Calories"
          unit="kcal"
          size="large"
        />

        <MacroProgressBar
          current={totals.protein}
          target={objectives.protein}
          label="Protein"
          unit="g"
        />

        <MacroProgressBar
          current={totals.carbs}
          target={objectives.carbs}
          label="Carbs"
          unit="g"
        />

        <MacroProgressBar
          current={totals.fat}
          target={objectives.fats}
          label="Fats"
          unit="g"
        />

        <Box>
          <Text size="2">Fiber: {Math.round(totals.fiber * 10) / 10}g</Text>
        </Box>

        <Card size="2" mt="2">
          <Heading size="3" mb="2">
            Satiety Prediction
          </Heading>
          <Flex align="center" gap="2" mb="1">
            <Flex gap="1">
              {[1, 2, 3, 4, 5].map((level) => (
                <Text
                  key={level}
                  size="4"
                  style={{
                    color:
                      level <= satietyScore
                        ? "var(--green-9)"
                        : "var(--gray-6)",
                  }}
                >
                  ●
                </Text>
              ))}
            </Flex>
            <Text size="3" weight="medium">
              {
                ["", "Low", "Light", "Moderate", "High", "Very High"][
                  satietyScore
                ]
              }{" "}
              ({satietyScore}/5)
            </Text>
          </Flex>
          <Text size="2">{satietyDuration} fullness</Text>
          <Text size="2" color="gray">
            Volume: ~{Math.round(totals.volume)}ml
          </Text>
        </Card>
      </Flex>
    </Card>
  );
}
