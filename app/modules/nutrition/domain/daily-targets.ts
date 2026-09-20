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
