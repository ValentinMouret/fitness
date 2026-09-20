export interface DashboardStatViewModel {
  readonly name: string;
  readonly value: string;
  readonly target: string | null;
  readonly unit: string;
  readonly detail: string;
  readonly progress: number | null;
  readonly accessibleValue: string;
}

interface DashboardStatsInput {
  readonly calories: number;
  readonly calorieTarget: number;
  readonly protein: number;
  readonly proteinTarget: number;
  readonly weight: number | undefined;
  readonly weightTarget: number | undefined;
  readonly weightUnit: string;
}

function intakeStat(
  name: string,
  current: number,
  goal: number,
  unit: string,
): DashboardStatViewModel {
  const value = Math.round(current).toLocaleString("en-US");
  const hasGoal = Number.isFinite(goal) && goal > 0;
  const percent = hasGoal ? Math.round((current / goal) * 100) : null;
  const target = hasGoal ? Math.round(goal).toLocaleString("en-US") : null;

  return {
    name,
    value,
    target,
    unit,
    detail: percent === null ? "No goal set" : `${percent}% of goal`,
    progress: percent === null ? null : Math.min(100, Math.max(0, percent)),
    accessibleValue: target
      ? `${value} of ${target} ${unit}`
      : `${value} ${unit}; no goal set`,
  };
}

export function createDashboardStatsViewModel(
  input: DashboardStatsInput,
): readonly DashboardStatViewModel[] {
  const weightFormat = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  });
  const weight =
    input.weight === undefined ? "—" : weightFormat.format(input.weight);
  const weightTarget =
    input.weightTarget !== undefined && input.weightTarget > 0
      ? weightFormat.format(input.weightTarget)
      : null;
  const distance =
    input.weight !== undefined &&
    weightTarget !== null &&
    input.weightTarget !== undefined
      ? Math.round(Math.abs(input.weight - input.weightTarget) * 10) / 10
      : null;

  return [
    intakeStat("Calories", input.calories, input.calorieTarget, "kcal"),
    intakeStat("Protein", input.protein, input.proteinTarget, "protein g"),
    {
      name: "Weight",
      value: weight,
      target: weightTarget,
      unit: input.weightUnit,
      detail:
        weightTarget === null
          ? "No goal set"
          : distance === null
            ? "No weight logged"
            : distance === 0
              ? "At goal"
              : `${weightFormat.format(distance)} ${input.weightUnit} to goal`,
      progress: null,
      accessibleValue: `${weight} ${input.weightUnit}${weightTarget === null ? "; no goal set" : `; goal ${weightTarget} ${input.weightUnit}`}`,
    },
  ];
}
