import { MeasurementRepository } from "../infra/measurements.repository.server";
import { MeasureRepository } from "../infra/measure.repository.server";
import { handleResultError } from "~/utils/errors";

export async function getMeasurementsPageData() {
  const measurements = await MeasurementRepository.fetchAll();

  if (measurements.isErr()) {
    handleResultError(measurements, "Failed to load measurements");
  }

  const measurementsWithLatest = await Promise.all(
    measurements.value.map(async (measurement) => {
      const latestMeasures = await MeasureRepository.fetchByMeasurementName(
        measurement.name,
        1,
      );

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
