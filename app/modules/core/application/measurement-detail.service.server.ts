import { handleResultError } from "~/utils/errors";
import { Measure } from "../domain/measure";
import { MeasureRepository } from "../infra/measure.repository.server";
import { MeasurementRepository } from "../infra/measurements.repository.server";

export async function getMeasurementDetail(name: string) {
  const measurement = await MeasurementRepository.fetchByName(name);
  if (measurement.isErr()) {
    handleResultError(measurement, "Failed to load measurement");
  }

  const measures = await MeasureRepository.fetchAll(name);
  if (measures.isErr()) {
    handleResultError(measures, "Failed to load measures");
  }

  return {
    measurement: measurement.value,
    measures: measures.value,
  };
}

export type AddMeasureResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function addMeasure(input: {
  readonly name: string;
  readonly value: number;
  readonly date: Date;
}): Promise<AddMeasureResult> {
  const measure = Measure.create(input.name, input.value, input.date);

  const result = await MeasureRepository.save(measure);
  if (result.isErr()) {
    return { ok: false, error: "Failed to save measure", status: 500 };
  }

  return { ok: true };
}

export type DeleteMeasureResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function deleteMeasure(input: {
  readonly name: string;
  readonly date: Date;
}): Promise<DeleteMeasureResult> {
  const result = await MeasureRepository.delete(input.name, input.date);
  if (result.isErr()) {
    return { ok: false, error: "Failed to delete measure", status: 500 };
  }

  return { ok: true };
}
