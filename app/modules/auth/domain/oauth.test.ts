import { describe, expect, it } from "vitest";
import { connectionIsActive, validateAuthorization } from "./oauth";

const client = {
  id: "chatgpt",
  name: "ChatGPT",
  secret: "test-secret-long-enough",
  redirectUri: "https://client.example/callback",
};
const resource = "https://fitness.example/mcp";
const params = {
  response_type: "code",
  client_id: client.id,
  redirect_uri: client.redirectUri,
  scope: "fitness",
  resource,
  code_challenge: "a".repeat(43),
  code_challenge_method: "S256",
};

describe("OAuth authorization policy", () => {
  it("permits authorization without optional state", () =>
    expect(validateAuthorization(params, [client], resource).isOk()).toBe(
      true,
    ));
  it.each([
    { redirect_uri: `${client.redirectUri}?extra=1` },
    { client_id: "unknown" },
    { scope: "fitness admin" },
    { resource: "https://other.example/mcp" },
    { code_challenge_method: "plain" },
    { code_challenge: "short" },
    { response_type: "token" },
  ])("rejects an unsupported authorization request %j", (override) => {
    expect(
      validateAuthorization(
        { ...params, ...override },
        [client],
        resource,
      ).isErr(),
    ).toBe(true);
  });
  it("checks connection revocation, scope and resource", () => {
    const active = { revokedAt: null, resource, scope: "fitness" };
    expect(connectionIsActive(active, resource)).toBe(true);
    expect(
      connectionIsActive({ ...active, revokedAt: new Date() }, resource),
    ).toBe(false);
    expect(connectionIsActive({ ...active, scope: "admin" }, resource)).toBe(
      false,
    );
    expect(connectionIsActive(active, "https://other.example/mcp")).toBe(false);
  });
});
