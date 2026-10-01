export interface DailyTargets {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export const defaultDailyTargets: DailyTargets = {
  calories: 2100,
  protein: 140,
  carbs: 220,
  fat: 85,
};

export function dailyTargetsFromCalories(calories: number): DailyTargets {
  return {
    calories,
    protein: Math.round((calories * 0.3) / 4),
    carbs: Math.round((calories * 0.4) / 4),
    fat: Math.round((calories * 0.3) / 9),
  };
}

export interface ResolvedDailyTargets {
  readonly targets: DailyTargets;
  readonly source: "saved" | "default";
}

export function resolveDailyTargets(
  calories: number | undefined,
): ResolvedDailyTargets {
  return calories === undefined
    ? { targets: defaultDailyTargets, source: "default" }
    : { targets: dailyTargetsFromCalories(calories), source: "saved" };
}
