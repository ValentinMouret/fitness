import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { RouterContextProvider } from "react-router";
import { z } from "zod";
import { diagnosticMiddleware } from "../../app/diagnostics-middleware.server";
import { logger } from "../../app/logger.server";
import { observeMcpTransport } from "../../app/modules/mcp/infra/diagnostics.server";

const secret = "private-health-token-email@example.invalid";
async function request(path: string, next: () => Promise<Response>) {
  const response = await diagnosticMiddleware(
    {
      request: new Request(`http://localhost${path}`, {
        headers: { "X-Request-Id": secret },
      }),
      params: {},
      unstable_pattern: "/",
      context: new RouterContextProvider(),
    },
    next,
  );
  if (!(response instanceof Response)) throw new Error("Missing response");
  return response.headers.get("X-Request-Id");
}
if (process.argv[2] === "unknown-release") {
  logger.error({ err: new Error(secret) }, secret);
  process.exit(0);
}
const ids = await Promise.all([
  request(`/workouts/${secret}?token=${secret}`, async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    logger.error(
      {
        err: Object.assign(new Error(secret), {
          code: "ECONNREFUSED",
          query: secret,
          params: [secret],
        }),
        email: secret,
      },
      secret,
    );
    return new Response(null, { status: 503 });
  }),
  request("/mcp", async () => {
    const result = await toolRequest("log_meal", {});
    const payload = await result.clone().json();
    if (payload.result?.content[0]?.text !== secret)
      throw new Error("Tool response was changed");
    return result;
  }),
]);
if (new Set(ids).size !== 2 || ids.includes(secret))
  throw new Error("Untrusted/concurrent request IDs");
process.env.GIT_SHA = "b".repeat(40);
await request("/mcp", async () => toolRequest("query", {}));
await request("/mcp", async () => toolRequest("log_meal", { amount: secret }));
await request(`/unknown/${secret}`, async () =>
  Response.redirect("http://localhost/sign-in"),
);
await request("/mcp", async () => toolRequest("log_meal", {}, 2));
await request("/mcp", async () => toolRequest("log_meal", {}, 101));
try {
  await request("/healthz", async () => {
    throw new Response(null, { status: 503 });
  });
  throw new Error("Thrown response missing");
} catch (error) {
  if (
    !(error instanceof Response) ||
    !z.uuid().safeParse(error.headers.get("X-Request-Id")).success
  )
    throw new Error("Thrown response correlation missing");
}
logger.info({ sql: secret }, secret);
logger.error({ err: new Error(secret), nested: { password: secret } }, secret);

async function toolRequest(name: string, args: unknown, count = 1) {
  const server = new McpServer({ name: "diagnostic-fixture", version: "1" });
  server.registerTool(
    "log_meal",
    { inputSchema: z.object({ amount: z.number().optional() }).strict() },
    async () => ({
      content: [{ type: "text", text: secret }],
      structuredContent: { error: { code: "conflict", message: secret } },
      isError: true,
    }),
  );
  server.registerTool(
    "query",
    { inputSchema: z.object({}).strict() },
    async () => {
      throw Object.assign(new Error(secret), { code: "57014" });
    },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    observeMcpTransport(transport);
    return await transport.handleRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify(
          count === 1
            ? {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name, arguments: args },
              }
            : Array.from({ length: count }, (_, index) => ({
                jsonrpc: "2.0",
                id: index + 1,
                method: "tools/call",
                params: { name, arguments: args },
              })),
        ),
      }),
    );
  } finally {
    await server.close();
  }
}
