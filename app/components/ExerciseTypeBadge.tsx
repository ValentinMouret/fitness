import { Badge } from "@radix-ui/themes";
import type { ExerciseType } from "~/modules/fitness/domain/workout";
import { capitalize } from "~/strings";
import { semanticColors } from "~/design-system";

interface Props {
  readonly type: ExerciseType;
}

export default function ExerciseTypeBadge({ type }: Props) {
  return <Badge color={semanticColors.exerciseTypes[type]}>{capitalize(type)}</Badge>;
}
