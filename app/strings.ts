import _ from "lodash";

export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

export function snakeCaseToHuman(str: string): string {
  return str.replaceAll("_", " ");
}

export const humanFormatting = _.flow(snakeCaseToHuman, capitalize);

export function coerceEmpty(str: string): string | undefined {
  return str === "" ? undefined : str;
}

export function isOneOf<T extends string>(
  values: ReadonlyArray<T>,
  value: string,
): value is T {
  return values.some((candidate) => candidate === value);
}
