import { MeasurementRepository } from "../infra/measurements.repository.server";

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export type CreateMeasurementResult =
  | {
      readonly ok: true;
      readonly name: string;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly status: number;
    };

export async function createMeasurement(input: {
  readonly rawName?: string;
  readonly unit?: string;
  readonly description?: string;
}): Promise<CreateMeasurementResult> {
  const { rawName, unit, description } = input;

  if (!rawName || !unit) {
    return { ok: false, error: "Name and unit are required", status: 400 };
  }

  const name = toSnakeCase(rawName);

  if (!name) {
    return {
      ok: false,
      error: "Name must contain at least one alphanumeric character",
      status: 400,
    };
  }

  const result = await MeasurementRepository.save({
    name,
    unit: unit.trim(),
    description: description?.trim() || undefined,
  });

  if (result.isErr()) {
    return { ok: false, error: "Failed to create measurement", status: 500 };
  }

  return { ok: true, name };
}
