import { NutritionCalculationService } from "~/modules/nutrition/domain/nutrition-calculation-service";
import { Age, Height, Weight } from "~/modules/core/domain/measurements";
import { Activity } from "~/modules/nutrition/domain/activity";
import { Target } from "~/modules/core/domain/target";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { TargetService } from "~/modules/core/application/measurement-service";

export function calculateTargets(input: {
  readonly age: number;
  readonly height: number;
  readonly weight: number;
  readonly activity: number;
  readonly delta: number;
}) {
  const maintenance = NutritionCalculationService.mifflinStJeor({
    age: Age.years(input.age),
    height: Height.cm(input.height),
    weight: Weight.kg(input.weight),
    activity: Activity.ratio(input.activity),
  });

  const target = Math.round((1 + input.delta / 100) * maintenance);

  return {
    ...input,
    maintenance,
    target,
    macrosSplit: NutritionCalculationService.macrosSplit({
      calories: target,
      weight: input.weight,
    }),
  };
}

export async function saveNutritionTarget(input: {
  readonly age: number;
  readonly height: number;
  readonly weight: number;
  readonly activity: number;
  readonly delta: number;
}) {
  const maintenance = NutritionCalculationService.mifflinStJeor({
    age: Age.years(input.age),
    height: Height.cm(input.height),
    weight: Weight.kg(input.weight),
    activity: Activity.ratio(input.activity),
  });

  const targetIntake = Math.round((1 + input.delta / 100) * maintenance);

  const target = Target.create({
    measurement: baseMeasurements.dailyCalorieIntake.name,
    value: targetIntake,
  });

  const saveResult = await TargetService.setTarget(target);

  if (saveResult.isErr()) {
    throw new Error(saveResult.error);
  }

  return { success: true };
}
