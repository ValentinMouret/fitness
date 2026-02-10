import type {
  MuscleRecoveryStatus,
  RecoveryMap,
  RecoveryStatus,
} from "~/modules/fitness/domain/muscle-recovery";
import type {
  MuscleGroup,
  MuscleGroupCategory,
} from "~/modules/fitness/domain/workout";
import { humanFormatting } from "~/strings";

export interface MuscleRecoveryViewModel {
  readonly muscleGroup: MuscleGroup;
  readonly label: string;
  readonly category: MuscleGroupCategory;
  readonly percentage: number;
  readonly percentageDisplay: string;
  readonly status: RecoveryStatus;
  readonly color: string;
  readonly hoursUntilFresh?: number;
  readonly timeUntilFreshDisplay?: string;
}

const STATUS_COLORS: Record<RecoveryStatus, string> = {
  fatigued: "#e5484d",
  recovering: "#f59e0b",
  fresh: "#30a46c",
};

function interpolateColor(percentage: number): string {
  if (percentage >= 80) return STATUS_COLORS.fresh;
  if (percentage >= 50) return STATUS_COLORS.recovering;
  return STATUS_COLORS.fatigued;
}

function formatTimeUntilFresh(hours: number): string {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `~${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 2) return "~1d";
  return `~${Math.round(days)}d`;
}

function createMuscleRecoveryViewModel(
  status: MuscleRecoveryStatus,
): MuscleRecoveryViewModel {
  return {
    muscleGroup: status.muscleGroup,
    label: humanFormatting(status.muscleGroup),
    category: status.category,
    percentage: status.recoveryPercentage,
    percentageDisplay: `${status.recoveryPercentage}%`,
    status: status.status,
    color: interpolateColor(status.recoveryPercentage),
    hoursUntilFresh: status.hoursUntilFresh,
    timeUntilFreshDisplay:
      status.hoursUntilFresh !== undefined
        ? formatTimeUntilFresh(status.hoursUntilFresh)
        : undefined,
  };
}

export function createRecoveryViewModels(
  recoveryMap: RecoveryMap,
): ReadonlyArray<MuscleRecoveryViewModel> {
  return recoveryMap.map(createMuscleRecoveryViewModel);
}

export function groupByCategory(
  viewModels: ReadonlyArray<MuscleRecoveryViewModel>,
): ReadonlyArray<{
  readonly category: MuscleGroupCategory;
  readonly label: string;
  readonly muscles: ReadonlyArray<MuscleRecoveryViewModel>;
}> {
  const categoryOrder: ReadonlyArray<MuscleGroupCategory> = [
    "arms",
    "back",
    "core",
    "legs",
  ];

  const categoryLabels: Record<MuscleGroupCategory, string> = {
    arms: "Arms",
    back: "Back",
    core: "Core",
    legs: "Legs",
  };

  return categoryOrder.map((category) => ({
    category,
    label: categoryLabels[category],
    muscles: viewModels
      .filter((vm) => vm.category === category)
      .sort((a, b) => a.percentage - b.percentage),
  }));
}
