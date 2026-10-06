import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { diagnosticCategory } from "~/diagnostics";
import contract from "~/diagnostics.schema.json" with { type: "json" };
import { logDiagnostic } from "~/logger.server";

const call = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.literal("tools/call"),
  params: z.object({ name: z.string() }),
});
const response = z.object({
  id: z.union([z.string(), z.number()]),
  result: z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z
        .object({ error: z.object({ code: z.string() }).optional() })
        .optional(),
    })
    .optional(),
  error: z.object({ code: z.number() }).optional(),
});

export function observeMcpTransport(
  transport: WebStandardStreamableHTTPServerTransport,
) {
  const pending = new Map<
    string | number,
    { readonly tool?: string; readonly startedAt: number }
  >();
  let overflowReported = false;
  const receive = transport.onmessage;
  transport.onmessage = (message, extra) => {
    const parsed = call.safeParse(message);
    if (parsed.success) {
      if (pending.size < 100)
        pending.set(parsed.data.id, {
          tool: contract.tools.includes(parsed.data.params.name)
            ? parsed.data.params.name
            : undefined,
          startedAt: performance.now(),
        });
      else if (!overflowReported) {
        overflowReported = true;
        logDiagnostic({
          event: "server.error",
          severity: "warn",
          outcome: "error",
          category: "rate_limited",
        });
      }
    }
    receive?.(message, extra);
  };
  const send = transport.send.bind(transport);
  transport.send = async (message, options) => {
    const parsed = response.safeParse(message);
    const operation = parsed.success ? pending.get(parsed.data.id) : undefined;
    if (!operation) return send(message, options);
    if (parsed.success) pending.delete(parsed.data.id);
    const complete = (failed: boolean, category: string) =>
      logDiagnostic({
        event: "mcp.complete",
        tool: operation.tool,
        severity: failed ? "warn" : "info",
        outcome: failed ? "error" : "ok",
        category,
        duration_ms: Math.min(
          3_600_000,
          Math.max(0, performance.now() - operation.startedAt),
        ),
      });
    try {
      await send(message, options);
      if (parsed.success) {
        const failed = Boolean(
          parsed.data.error || parsed.data.result?.isError,
        );
        complete(
          failed,
          failed
            ? diagnosticCategory(parsed.data.result?.structuredContent?.error)
            : "none",
        );
      }
    } catch (error) {
      complete(true, diagnosticCategory(error));
      throw error;
    }
  };
}
