export interface NutritionTotalsViewModel {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber: number;
  readonly volume: number;
}

export interface DailyTargetsViewModel {
  readonly calories: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export interface DailyProgressViewModel {
  readonly totals: NutritionTotalsViewModel;
  readonly targets: DailyTargetsViewModel;
  readonly progress: {
    readonly calories: ProgressItemViewModel;
    readonly protein: ProgressItemViewModel;
    readonly carbs: ProgressItemViewModel;
    readonly fat: ProgressItemViewModel;
  };
}

export interface ProgressItemViewModel {
  readonly current: number;
  readonly target: number;
  readonly percentage: number;
  readonly displayText: string;
}

export function createDailyProgressViewModel(
  totals: NutritionTotalsViewModel,
  targets: DailyTargetsViewModel,
): DailyProgressViewModel {
  const createProgress = (
    current: number,
    target: number,
    unit: string,
  ): ProgressItemViewModel => ({
    current,
    target,
    percentage: Math.round((current / target) * 100),
    displayText: `${Math.round(current)} / ${target} ${unit} (${Math.round((current / target) * 100)}%)`,
  });

  return {
    totals,
    targets,
    progress: {
      calories: createProgress(totals.calories, targets.calories, "kcal"),
      protein: createProgress(totals.protein, targets.protein, "g"),
      carbs: createProgress(totals.carbs, targets.carbs, "g"),
      fat: createProgress(totals.fat, targets.fat, "g"),
    },
  };
}
