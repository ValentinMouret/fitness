import type { UserId } from "~/modules/auth/domain/user";
import { handleResultError } from "~/utils/errors";
import { createMeasureRepository } from "./measure.repository.server";
import { createMeasurementRepository } from "./measurements.repository.server";

export async function getMeasurementsPageData(userId: UserId) {
  const measurements = await createMeasurementRepository(userId).fetchAll();

  if (measurements.isErr()) {
    handleResultError(measurements, "Failed to load measurements");
  }

  const measurementsWithLatest = await Promise.all(
    measurements.value.map(async (measurement) => {
      const latestMeasures = await createMeasureRepository(
        userId,
      ).fetchByMeasurementName(measurement.name, 1);

      return {
        ...measurement,
        latestValue:
          latestMeasures.isOk() && latestMeasures.value.length > 0
            ? latestMeasures.value[0]
            : null,
      };
    }),
  );

  return {
    measurements: measurementsWithLatest,
  };
}
