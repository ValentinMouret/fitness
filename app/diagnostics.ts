import { z } from "zod";
import contract from "./diagnostics.schema.json" with { type: "json" };

export const diagnosticEventSchema = z
  .object({
    diagnostic_version: z.literal(1),
    event_id: z.uuid(),
    request_id: z.uuid(),
    release: z.string().regex(/^[a-f0-9]{40}$/),
    event: z.enum(contract.events),
    severity: z.enum(["info", "warn", "error"]),
    outcome: z.enum(["ok", "error"]),
    duration_ms: z.number().finite().min(0).max(3_600_000),
    category: z.enum(contract.categories),
    method: z.enum(contract.methods).optional(),
    status: z.number().int().min(100).max(599).optional(),
    route_id: z.enum(contract.routes).optional(),
    tool: z.enum(contract.tools).optional(),
  })
  .strict();
export type DiagnosticEvent = Readonly<z.infer<typeof diagnosticEventSchema>>;

export function diagnosticRoute(url: string): string | undefined {
  const path = new URL(url).pathname.replace(/\.data$/, "");
  return contract.routes.find((route) => {
    const pattern = route
      .split("/")
      .map((part) =>
        part === "*"
          ? ".*"
          : part.startsWith(":")
            ? "[^/]+"
            : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    return new RegExp(`^${pattern}$`).test(path);
  });
}

export function diagnosticCategory(error: unknown): string {
  const code = z.object({ code: z.string() }).safeParse(error);
  if (!code.success) return "unexpected";
  switch (code.data.code) {
    case "invalid_input":
      return "validation";
    case "not_found":
      return "not_found";
    case "conflict":
      return "conflict";
    case "57014":
    case "ETIMEDOUT":
      return "timeout";
    case "database_error":
    case "ECONNREFUSED":
    case "ECONNRESET":
      return "dependency";
    default:
      return "unexpected";
  }
}

export function statusCategory(status: number): string {
  if (status < 400) return "none";
  switch (status) {
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    case 503:
      return "dependency";
    case 504:
      return "timeout";
    default:
      return "unexpected";
  }
}
