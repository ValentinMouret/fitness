import { db } from "~/db";
import type { UserId } from "~/modules/auth/domain/user";
import {
  Age,
  baseMeasurements,
  Height,
  Weight,
} from "~/modules/core/domain/measurements";
import { Target } from "~/modules/core/domain/target";
import { createMeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import { createTargetRepository } from "~/modules/core/infra/target.repository.server";
import { Activity } from "~/modules/nutrition/domain/activity";
import {
  type Gender,
  NutritionCalculationService,
} from "~/modules/nutrition/domain/nutrition-calculation-service";

export function calculateTargets(input: {
  readonly age: number;
  readonly height: number;
  readonly weight: number;
  readonly activity: number;
  readonly delta: number;
  readonly gender: Gender;
}) {
  const maintenance = NutritionCalculationService.mifflinStJeor({
    age: Age.years(input.age),
    height: Height.cm(input.height),
    weight: Weight.kg(input.weight),
    activity: Activity.ratio(input.activity),
    gender: input.gender,
  });

  const target = Math.round((1 + input.delta / 100) * maintenance);

  return {
    age: input.age,
    height: input.height,
    weight: input.weight,
    activity: input.activity,
    delta: input.delta,
    gender: input.gender,
    maintenance,
    target,
    macrosSplit: NutritionCalculationService.macrosSplit({
      calories: target,
      weight: input.weight,
    }),
  };
}

export async function saveNutritionTarget(
  userId: UserId,
  input: {
    readonly age: number;
    readonly height: number;
    readonly weight: number;
    readonly activity: number;
    readonly delta: number;
    readonly gender: Gender;
  },
) {
  const maintenance = NutritionCalculationService.mifflinStJeor({
    age: Age.years(input.age),
    height: Height.cm(input.height),
    weight: Weight.kg(input.weight),
    activity: Activity.ratio(input.activity),
    gender: input.gender,
  });

  const targetIntake = Math.round((1 + input.delta / 100) * maintenance);

  const target = Target.create({
    measurement: baseMeasurements.dailyCalorieIntake.name,
    value: targetIntake,
  });

  await db.transaction(async (transaction) => {
    const definition = await createMeasurementRepository(userId).ensure(
      baseMeasurements.dailyCalorieIntake,
      transaction,
    );
    if (definition.isErr()) throw new Error(definition.error);
    const saveResult = await createTargetRepository(userId, transaction).set(
      target,
    );
    if (saveResult.isErr()) throw new Error(saveResult.error);
  });

  return { success: true };
}
