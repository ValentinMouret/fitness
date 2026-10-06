import { randomUUID } from "node:crypto";
import pino from "pino";
import { diagnosticCategory, diagnosticEventSchema } from "./diagnostics";
import { diagnosticContext } from "./diagnostics-context.server";

const isDev = process.env.NODE_ENV !== "production";
const destination = pino.destination(1);
const output = pino(
  { level: isDev ? "debug" : "info", base: undefined },
  destination,
);
if (!isDev && !/^[a-f0-9]{40}$/.test(process.env.GIT_SHA ?? "")) {
  output.error({ diagnostic_configuration: "release_missing" });
}

export function logDiagnostic(fields: Readonly<Record<string, unknown>>) {
  const context = diagnosticContext.getStore();
  const parsed = diagnosticEventSchema.safeParse({
    ...fields,
    diagnostic_version: 1,
    event_id: randomUUID(),
    request_id: context?.requestId ?? randomUUID(),
    release: process.env.GIT_SHA,
    duration_ms: Math.min(
      3_600_000,
      Math.max(
        0,
        typeof fields.duration_ms === "number"
          ? fields.duration_ms
          : performance.now() - (context?.startedAt ?? performance.now()),
      ),
    ),
    route_id: context?.routeId,
    method: context?.method,
  });
  if (!parsed.success) return;
  output[parsed.data.severity](parsed.data);
}

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
    hooks: {
      logMethod(args, method, level) {
        // Existing callers may pass SQL errors or health-bearing text.
        const value = args[0];
        const error =
          typeof value === "object" && value !== null && "err" in value
            ? value.err
            : undefined;
        if (level >= 40) {
          logDiagnostic({
            event: "server.error",
            severity: level >= 50 ? "error" : "warn",
            outcome: "error",
            category: diagnosticCategory(error),
          });
        }
        method.call(this, {
          severity: level >= 50 ? "error" : level >= 40 ? "warn" : "info",
          category: level >= 40 ? diagnosticCategory(error) : "none",
        });
      },
    },
    base: undefined,
  },
  destination,
);
