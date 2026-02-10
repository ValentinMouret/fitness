import { Badge } from "@radix-ui/themes";
import { semanticColors } from "~/design-system";
import type { ExerciseType } from "~/modules/fitness/domain/workout";
import { capitalize } from "~/strings";

interface ExerciseTypeBadgeProps {
  readonly type: ExerciseType;
}

export function ExerciseTypeBadge({ type }: ExerciseTypeBadgeProps) {
  return (
    <Badge color={semanticColors.exerciseTypes[type]}>{capitalize(type)}</Badge>
  );
}
