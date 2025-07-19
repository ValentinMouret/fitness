import { db } from "~/db";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import type { Target } from "~/modules/core/domain/target";
import { TargetRepository } from "~/modules/core/infra/repository";

export const TargetService = {
  async setTarget(target: Target) {
    await db.transaction(async (tx) => {
      const result = await MeasurementRepository.save(
        baseMeasurements.dailyCalorieIntake,
        tx,
      )
        .andThen(() =>
          TargetRepository.unsetTargetsByName(target.measurement, tx),
        )
        .andThen(() => TargetRepository.save(target, tx));

      if (result.isErr()) {
        throw new Error(result.error);
      }

      return result.value;
    });
  },

  async currentTargets() {
    return TargetRepository.listAllActive();
  },
};
