import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { findAccess } from "./oauth.repository.server";
import { oauthConfig } from "./oauth-config.server";
import { oauthError, privateHeaders } from "./oauth-http.server";

export async function handleMcp(request: Request) {
  const config = oauthConfig();
  const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(
    request.headers.get("Authorization") ?? "",
  )?.[1];
  const challenge = () =>
    Response.json(
      { error: "invalid_token" },
      {
        status: 401,
        headers: {
          ...privateHeaders,
          "WWW-Authenticate": `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource", scope="fitness"`,
        },
      },
    );
  if (!bearer) return challenge();
  const access = await findAccess(
    bearer,
    config.resource,
    config.clients.map((client) => client.id),
  );
  if (access.isErr()) return oauthError(access.error);
  if (!access.value) return challenge();
  const server = new McpServer(
    { name: "Fitness", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}
