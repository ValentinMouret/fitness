import { type Result, ok, err } from "neverthrow";
import type { ErrValidation } from "./repository";

export function resultFromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> {
  return value != null ? ok(value) : err(error);
}

export function coerceInt(v: string): Result<number, ErrValidation> {
  const parsed = parseInt(v);
  return Number.isNaN(parsed) ? err("validation_error") : ok(parsed);
}

export function coerceFloat(v: string): Result<number, ErrValidation> {
  const parsed = parseFloat(v);
  return Number.isNaN(parsed) ? err("validation_error") : ok(parsed);
}

export function pprint(o: object) {
  console.dir(o, { depth: null });
}
