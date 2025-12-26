export function assertNever(_: never): never {
  throw new Error("This should *never* happen");
}
export type AssertNever<T extends never> = T;

/**
 * Gives a compile-time error if the sequence is empty.
 */
export type NotEmpty<T> = [T, ...T[]];

export function isNotEmpty<T>(array: T[]): array is [T, ...T[]] {
  return array.length > 0;
}

export function isNotNil<T>(el: T | null | undefined): el is T {
  return el !== null && el !== undefined;
}

/**
 * Nominal types are used to give names to types.
 * @example
 * ```typescript
 * type EmailAddress = NominalType<string, 'EmailAddress'>;
 *
 * function parseEmailAddress(input: string): EmailAddress | undefined {
 *   if (...) // run checks
     return input as EmailAddress;
 * }
 *
 * function sendEmail(email: EmailAddress) {} // Compile check that we pass an email address.
 * ```
 */
export type NominalType<T, Brand extends string> = T & {
  readonly __brand: Brand;
};
