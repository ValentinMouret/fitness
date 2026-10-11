import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { diagnosticCategory, statusCategory } from "~/diagnostics";
import contract from "~/diagnostics.schema.json" with { type: "json" };
import { logDiagnostic } from "~/logger.server";

const call = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.enum(contract.rpc_methods),
  params: z.object({ name: z.string().optional() }).optional(),
});
const response = z.object({
  id: z.union([z.string(), z.number()]).nullable(),
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

function rpcError(code: number | undefined) {
  if (code === undefined) return undefined;
  switch (code) {
    case -32700:
      return "parse_error";
    case -32600:
      return "invalid_request";
    case -32601:
      return "method_not_found";
    case -32602:
      return "invalid_params";
    case -32603:
      return "internal_error";
    case -32000:
      return "server_error";
    default:
      return "other";
  }
}

async function rejectedError(reply: Response) {
  const reader = reply.clone().body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 4096) return undefined;
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const parsed = response.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    return parsed.success ? rpcError(parsed.data.error?.code) : undefined;
  } catch {
    return undefined;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export function observeMcpTransport(
  transport: WebStandardStreamableHTTPServerTransport,
) {
  const pending = new Map<
    string | number,
    {
      readonly method: string;
      readonly tool?: string;
      readonly startedAt: number;
    }
  >();
  let protocol = "absent";
  let overflowReported = false;
  const receive = transport.onmessage;
  transport.onmessage = (message, extra) => {
    const parsed = call.safeParse(message);
    if (parsed.success) {
      if (pending.size < 100)
        pending.set(parsed.data.id, {
          method: parsed.data.method,
          tool:
            parsed.data.method === "tools/call" &&
            contract.tools.includes(parsed.data.params?.name ?? "")
              ? parsed.data.params?.name
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
    const operation =
      parsed.success && parsed.data.id !== null
        ? pending.get(parsed.data.id)
        : undefined;
    if (!operation) return send(message, options);
    if (parsed.success && parsed.data.id !== null)
      pending.delete(parsed.data.id);
    const complete = (failed: boolean, category: string) =>
      logDiagnostic({
        event: "mcp.complete",
        rpc_method: operation.method,
        mcp_protocol: protocol,
        rpc_error: parsed.success
          ? rpcError(parsed.data.error?.code)
          : undefined,
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
        const code = parsed.data.error?.code;
        complete(
          failed,
          code === -32602 || code === -32600 || code === -32700
            ? "validation"
            : failed
              ? diagnosticCategory(parsed.data.result?.structuredContent?.error)
              : "none",
        );
      }
    } catch (error) {
      complete(true, diagnosticCategory(error));
      throw error;
    }
  };
  return async (request: Request) => {
    const version = request.headers.get("MCP-Protocol-Version");
    protocol =
      version === null
        ? "absent"
        : contract.mcp_protocols.includes(version) &&
            version !== "absent" &&
            version !== "unsupported"
          ? version
          : "unsupported";
    const startedAt = performance.now();
    const reply = await transport.handleRequest(request);
    if (reply.status >= 400) {
      logDiagnostic({
        event: "mcp.complete",
        mcp_protocol: protocol,
        rpc_error: await rejectedError(reply),
        status: reply.status,
        severity: "warn",
        outcome: "error",
        category: statusCategory(reply.status),
        duration_ms: performance.now() - startedAt,
      });
    }
    return reply;
  };
}
