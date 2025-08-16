import type { Measurement } from "./measurements";

export interface Measure {
  readonly measurementName: Measurement["name"];
  readonly value: number;
  readonly t: Date;
}

export const Measure = {
  create(measurementName: string, value: number, date?: Date): Measure {
    return {
      measurementName,
      value,
      t: date ?? new Date(),
    };
  },
};
