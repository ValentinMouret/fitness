import { randomUUID } from "node:crypto";
import type { MiddlewareFunction } from "react-router";
import { diagnosticRoute, statusCategory } from "./diagnostics";
import { diagnosticContext } from "./diagnostics-context.server";
import { logDiagnostic } from "./logger.server";

export const diagnosticMiddleware: MiddlewareFunction<Response> = async (
  { request },
  next,
) => {
  const context = {
    requestId: randomUUID(),
    startedAt: performance.now(),
    routeId: diagnosticRoute(request.url),
    method: request.method,
  };
  return diagnosticContext.run(context, async () => {
    try {
      const response = await next();
      const headers = new Headers(response.headers);
      headers.set("X-Request-Id", context.requestId);
      logDiagnostic({
        event: "request.complete",
        severity: response.status >= 500 ? "error" : "info",
        outcome: response.status >= 400 ? "error" : "ok",
        category: statusCategory(response.status),
        status: response.status,
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const status = error instanceof Response ? error.status : 500;
      logDiagnostic({
        event: "request.complete",
        severity: status >= 500 ? "error" : "info",
        outcome: "error",
        category: statusCategory(status),
        status,
      });
      if (error instanceof Response) {
        const headers = new Headers(error.headers);
        headers.set("X-Request-Id", context.requestId);
        throw new Response(error.body, {
          status: error.status,
          statusText: error.statusText,
          headers,
        });
      }
      throw error;
    }
  });
};
