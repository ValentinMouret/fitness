import type { UserId } from "~/modules/auth/domain/user";
import { handleResultError } from "~/utils/errors";
import { Measure } from "../domain/measure";
import { createMeasureRepository } from "./measure.repository.server";
import { createMeasurementRepository } from "./measurements.repository.server";

export async function getMeasurementDetail(userId: UserId, name: string) {
  const measurement =
    await createMeasurementRepository(userId).fetchByName(name);
  if (measurement.isErr()) {
    handleResultError(
      measurement,
      "Measurement not found",
      measurement.error === "not_found" ? 404 : 500,
    );
  }

  const measures = await createMeasureRepository(userId).fetchAll(name);
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

export async function addMeasure(
  userId: UserId,
  input: {
    readonly name: string;
    readonly value: number;
    readonly date: Date;
  },
): Promise<AddMeasureResult> {
  const measurement = await createMeasurementRepository(userId).fetchByName(
    input.name,
  );
  if (measurement.isErr())
    return {
      ok: false,
      error: "Measurement not found",
      status: measurement.error === "not_found" ? 404 : 500,
    };
  const measure = Measure.create(input.name, input.value, input.date);

  const result = await createMeasureRepository(userId).save(measure);
  if (result.isErr()) {
    return { ok: false, error: "Failed to save measure", status: 500 };
  }

  return { ok: true };
}

export type DeleteMeasureResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly status: number };

export async function deleteMeasure(
  userId: UserId,
  input: {
    readonly name: string;
    readonly date: Date;
  },
): Promise<DeleteMeasureResult> {
  const result = await createMeasureRepository(userId).delete(
    input.name,
    input.date,
  );
  if (result.isErr()) {
    return {
      ok: false,
      error: "Failed to delete measure",
      status: result.error === "not_found" ? 404 : 500,
    };
  }

  return { ok: true };
}
