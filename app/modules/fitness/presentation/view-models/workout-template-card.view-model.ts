import type { WorkoutTemplateWithDetails } from "../../domain/workout-template";

export interface WorkoutTemplateCardViewModel {
  readonly id: string;
  readonly name: string;
  readonly exerciseCount: number;
  readonly exerciseNames: ReadonlyArray<string>;
  readonly usageCount: number;
  readonly usageLabel: string;
  readonly lastUsedLabel: string;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function createWorkoutTemplateCardViewModel(
  template: WorkoutTemplateWithDetails,
): WorkoutTemplateCardViewModel {
  return {
    id: template.id,
    name: template.name,
    exerciseCount: template.exerciseDetails.length,
    exerciseNames: template.exerciseDetails.slice(0, 3).map((e) => e.name),
    usageCount: template.usageCount,
    usageLabel:
      template.usageCount === 0
        ? "Never used"
        : `Used ${template.usageCount} time${template.usageCount !== 1 ? "s" : ""}`,
    lastUsedLabel: template.lastUsedAt
      ? `Last used ${formatRelativeDate(template.lastUsedAt)}`
      : "Never used",
  };
}
