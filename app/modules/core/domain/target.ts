import "node:crypto";

export interface Target {
  readonly id: string;
  readonly measurement: string;
  readonly value: number;
}

export const Target = {
  create(input: Omit<Target, "id">): Target {
    return {
      id: crypto.randomUUID(),
      measurement: input.measurement,
      value: input.value,
    };
  },
};
