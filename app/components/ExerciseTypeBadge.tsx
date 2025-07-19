import { Badge } from "@radix-ui/themes";
import type { Color } from "~/colors";
import type { ExerciseType } from "~/modules/fitness/domain/workout";
import { capitalize } from "~/strings";

interface Props {
  readonly type: ExerciseType;
}

const exerciseTypeColor: Record<ExerciseType, Color> = {
  barbell: "yellow",
  bodyweight: "gray",
  cable: "blue",
  dumbbells: "amber",
  machine: "gold",
};

export default function ExerciseTypeBadge({ type }: Props) {
  return <Badge color={exerciseTypeColor[type]}>{capitalize(type)}</Badge>;
}
