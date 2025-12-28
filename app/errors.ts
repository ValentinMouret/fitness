/**
 * UnknownError is thrown when we really do not expect an operation toxo fail.
 */
export class UnknownError extends Error {
  constructor(cause?: unknown) {
    super("UnknownError", { cause });
  }
}
