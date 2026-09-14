import { createHash, randomBytes } from "node:crypto";
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
} from "@playwright/test";
import { z } from "zod";
import { authTestEnv, credentials } from "./auth";

const settings = z
  .object({
    E2E_MCP_URL: z
      .url()
      .default(new URL("/mcp", authTestEnv.E2E_BASE_URL).href),
    E2E_CHATGPT_CLIENT_ID: z.string().default("fitness-e2e-chatgpt"),
    E2E_CHATGPT_CLIENT_SECRET: z.string().default("fitness-e2e-chatgpt-secret"),
    E2E_CHATGPT_CALLBACK: z
      .url()
      .default("https://chatgpt.example.invalid/callback"),
    E2E_CLAUDE_CLIENT_ID: z.string().default("fitness-e2e-claude"),
    E2E_CLAUDE_CLIENT_SECRET: z.string().default("fitness-e2e-claude-secret"),
    E2E_CLAUDE_CALLBACK: z
      .url()
      .default("https://claude.example.invalid/callback"),
    E2E_EXPIRY_SECONDS: z.coerce.number().int().min(1).max(10).default(2),
  })
  .parse(process.env);

export const mcpResource = settings.E2E_MCP_URL;
export const expirySeconds = settings.E2E_EXPIRY_SECONDS;
export const clients = [
  {
    name: "ChatGPT",
    id: settings.E2E_CHATGPT_CLIENT_ID,
    secret: settings.E2E_CHATGPT_CLIENT_SECRET,
    callback: settings.E2E_CHATGPT_CALLBACK,
  },
  {
    name: "Claude",
    id: settings.E2E_CLAUDE_CLIENT_ID,
    secret: settings.E2E_CLAUDE_CLIENT_SECRET,
    callback: settings.E2E_CLAUDE_CALLBACK,
  },
] as const;
export type OAuthClient = {
  readonly name: string;
  readonly id: string;
  readonly secret: string;
  readonly callback: string;
};

const metadataSchema = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  revocation_endpoint: z.url(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
  scopes_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
});
export type OAuthMetadata = z.infer<typeof metadataSchema>;

export async function discover(
  request: APIRequestContext,
): Promise<OAuthMetadata> {
  const response = await request.post(mcpResource, {
    headers: { Accept: "application/json, text/event-stream" },
    data: initializeRequest,
    maxRedirects: 0,
  });
  expect(response.status(), "MCP must challenge unauthenticated clients").toBe(
    401,
  );
  const challenge = response.headers()["www-authenticate"] ?? "";
  expect(challenge).toMatch(/^Bearer\b/i);
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1];
  if (!metadataUrl)
    throw new Error("MCP challenge is missing resource_metadata");
  expect(new URL(metadataUrl).origin).toBe(new URL(mcpResource).origin);
  const resourceResponse = await request.get(metadataUrl);
  expect(resourceResponse.status()).toBe(200);
  const resource = z
    .object({
      resource: z.url(),
      authorization_servers: z.array(z.url()).min(1),
      scopes_supported: z.array(z.string()),
    })
    .parse(await resourceResponse.json());
  expect(resource.resource).toBe(mcpResource);
  expect(resource.scopes_supported).toEqual(["fitness"]);
  const issuer = new URL(resource.authorization_servers[0]);
  expect(issuer.origin).toBe(new URL(mcpResource).origin);
  const metadataResponse = await request.get(
    `${issuer.origin}/.well-known/oauth-authorization-server${issuer.pathname === "/" ? "" : issuer.pathname}`,
  );
  expect(metadataResponse.status()).toBe(200);
  const metadata = metadataSchema.parse(await metadataResponse.json());
  expect(metadata.issuer).toBe(resource.authorization_servers[0]);
  for (const endpoint of [
    metadata.authorization_endpoint,
    metadata.token_endpoint,
    metadata.revocation_endpoint,
  ]) {
    expect(new URL(endpoint).origin).toBe(issuer.origin);
  }
  expect(metadata.scopes_supported).toEqual(["fitness"]);
  expect(metadata.code_challenge_methods_supported).toContain("S256");
  expect(metadata.response_types_supported).toEqual(["code"]);
  expect(metadata.grant_types_supported.toSorted()).toEqual([
    "authorization_code",
    "refresh_token",
  ]);
  return metadata;
}

export function authorization(
  metadata: OAuthMetadata,
  client: OAuthClient,
  overrides: Readonly<Record<string, string | null>> = {},
) {
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const url = new URL(metadata.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.id,
    redirect_uri: client.callback,
    scope: "fitness",
    resource: mcpResource,
    state,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  }).toString();
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return { url: url.href, verifier, state };
}

export async function showConsent(page: Page, url: string) {
  await page.goto(url);
  if (new URL(page.url()).pathname === "/login") {
    await page
      .getByPlaceholder("Enter your username")
      .fill(credentials.username);
    await page
      .getByPlaceholder("Enter your password")
      .fill(credentials.password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: /^allow( access)?$/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/read and update your fitness data/i),
  ).toBeVisible();
}

export async function decide(
  page: Page,
  client: OAuthClient,
  allow: boolean,
): Promise<URL> {
  // Intercept only the external callback; Fitness authorization and token requests remain real.
  await page.route(`${client.callback}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "OAuth test callback",
    }),
  );
  const callback = page.waitForRequest((request) => {
    const url = new URL(request.url());
    const registered = new URL(client.callback);
    return (
      url.origin === registered.origin && url.pathname === registered.pathname
    );
  });
  await page
    .getByRole("button", {
      name: allow ? /^allow( access)?$/i : /^(deny|cancel)$/i,
    })
    .click();
  return new URL((await callback).url());
}

export async function authorize(
  page: Page,
  metadata: OAuthMetadata,
  client: OAuthClient,
) {
  const transaction = authorization(metadata, client);
  await showConsent(page, transaction.url);
  await expect(page.getByText(client.name, { exact: true })).toBeVisible();
  const callback = await decide(page, client, true);
  expect(callback.searchParams.get("state")).toBe(transaction.state);
  expect(callback.searchParams.has("error")).toBe(false);
  const code = callback.searchParams.get("code");
  if (!code)
    throw new Error("Consent approval did not return an authorization code");
  expect(callback.searchParams.has("access_token")).toBe(false);
  return { ...transaction, code };
}

export async function clientPost(
  request: APIRequestContext,
  metadata: OAuthMetadata,
  client: OAuthClient,
  endpoint: string,
  form: Readonly<Record<string, string>>,
) {
  const basic = metadata.token_endpoint_auth_methods_supported.includes(
    "client_secret_basic",
  );
  if (!basic)
    expect(metadata.token_endpoint_auth_methods_supported).toContain(
      "client_secret_post",
    );
  return request.post(endpoint, {
    headers: basic
      ? {
          Authorization: `Basic ${Buffer.from(`${encodeURIComponent(client.id)}:${encodeURIComponent(client.secret)}`).toString("base64")}`,
        }
      : {},
    form: basic
      ? { ...form }
      : { ...form, client_id: client.id, client_secret: client.secret },
    maxRedirects: 0,
  });
}

export function exchange(
  request: APIRequestContext,
  metadata: OAuthMetadata,
  client: OAuthClient,
  grant: { readonly code: string; readonly verifier: string },
  overrides: Readonly<Record<string, string>> = {},
) {
  return clientPost(request, metadata, client, metadata.token_endpoint, {
    grant_type: "authorization_code",
    code: grant.code,
    code_verifier: grant.verifier,
    redirect_uri: client.callback,
    resource: mcpResource,
    ...overrides,
  });
}

export async function tokens(response: APIResponse) {
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(/no-store/i);
  const result = z
    .object({
      access_token: z.string().min(32),
      refresh_token: z.string().min(32),
      token_type: z.string(),
      expires_in: z.number().positive(),
      scope: z.literal("fitness"),
    })
    .parse(await response.json());
  expect(result.token_type.toLowerCase()).toBe("bearer");
  expect(result.access_token === result.refresh_token).toBe(false);
  return result;
}

export async function expectOAuthError(response: APIResponse, error: string) {
  expect(response.status()).toBe(error === "invalid_client" ? 401 : 400);
  const result = z
    .object({ error: z.string() })
    .passthrough()
    .parse(await response.json());
  expect(result.error).toBe(error);
  expect("access_token" in result || "refresh_token" in result).toBe(false);
}

export function refresh(
  request: APIRequestContext,
  metadata: OAuthMetadata,
  client: OAuthClient,
  token: string,
  overrides: Readonly<Record<string, string>> = {},
) {
  return clientPost(request, metadata, client, metadata.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: token,
    resource: mcpResource,
    ...overrides,
  });
}

export async function revoke(
  request: APIRequestContext,
  metadata: OAuthMetadata,
  client: OAuthClient,
  token: string,
) {
  const response = await clientPost(
    request,
    metadata,
    client,
    metadata.revocation_endpoint,
    { token, token_type_hint: "refresh_token" },
  );
  expect(response.status()).toBe(200);
}

const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "fitness-auth-e2e", version: "1.0.0" },
  },
};

export function initialize(request: APIRequestContext, token: string) {
  return request.post(mcpResource, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    data: initializeRequest,
    maxRedirects: 0,
  });
}

export async function expectMcpAccess(
  request: APIRequestContext,
  token: string,
) {
  const response = await initialize(request, token);
  expect(response.status()).toBe(200);
  const text = await response.text();
  const messages: unknown[] = response
    .headers()
    ["content-type"]?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)))
    : [JSON.parse(text)];
  expect(
    messages.some(
      (message) =>
        z
          .object({
            jsonrpc: z.literal("2.0"),
            id: z.literal(1),
            result: z.object({
              protocolVersion: z.string(),
              capabilities: z.object({}),
              serverInfo: z.object({ name: z.string() }),
            }),
          })
          .safeParse(message).success,
    ),
  ).toBe(true);
  return response.headers()["mcp-session-id"];
}

export async function expectMcpDenied(
  request: APIRequestContext,
  token: string,
) {
  const response = await initialize(request, token);
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toMatch(/\bBearer\b/i);
}
