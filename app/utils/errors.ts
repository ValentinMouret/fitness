/**
 * Standardized error handling utilities for React Router v7
 */

const statusTexts: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};
function getStatusText(status: number): string {
  return statusTexts[status] ?? "Unknown Error";
}

type ErrorCode = keyof typeof statusTexts;

/**
 * Creates a standardized server error response
 */
export function createServerError(
  message: string,
  status: ErrorCode = 500,
  cause?: unknown,
): Response {
  if (import.meta.env.DEV && cause) {
    console.error(`Server Error [${status}]:`, message, cause);
  }

  return new Response(message, {
    status,
    statusText: getStatusText(status),
  });
}

/**
 * Creates a validation error response (422)
 */
export function createValidationError(
  message: string,
  cause?: unknown,
): Response {
  return createServerError(message, 422, cause);
}

/**
 * Creates a not found error response (404)
 */
export function createNotFoundError(resource: string): Response {
  return createServerError(`${resource} not found`, 404);
}

/**
 * Creates an unauthorized error response (401)
 */
export function createUnauthorizedError(message = "Unauthorized"): Response {
  return createServerError(message, 401);
}

/**
 * Creates a bad request error response (400)
 */
export function createBadRequestError(
  message: string,
  cause?: unknown,
): Response {
  return createServerError(message, 400, cause);
}

/**
 * Helper to handle neverthrow Result errors consistently
 */
export function handleResultError(
  result: { isErr(): boolean; error: unknown },
  defaultMessage: string,
  status = 500,
): never {
  throw createServerError(defaultMessage, status, result.error);
}

/**
 * Helper to validate required parameters
 */
export function requireParam(
  value: unknown,
  paramName: string,
): asserts value is string {
  if (!value || typeof value !== "string") {
    throw createBadRequestError(`${paramName} is required`);
  }
}
