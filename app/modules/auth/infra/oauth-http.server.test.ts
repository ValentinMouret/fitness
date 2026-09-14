import { expect, it } from "vitest";
import { authenticateClient, readOAuthForm } from "./oauth-http.server";

const client = {
  id: "client:with colon",
  secret: "secret:with colon",
  redirectUri: "https://example.test/callback",
  name: "Client",
};
const url = "https://fitness.test/oauth/token";
it("authenticates form credentials and percent-encoded Basic credentials", () => {
  expect(
    authenticateClient(
      new Request(url),
      { client_id: client.id, client_secret: client.secret },
      [client],
    ).isOk(),
  ).toBe(true);
  const header = `Basic ${Buffer.from(`${encodeURIComponent(client.id)}:${encodeURIComponent(client.secret)}`).toString("base64")}`;
  expect(
    authenticateClient(
      new Request(url, { headers: { Authorization: header } }),
      {},
      [client],
    ).isOk(),
  ).toBe(true);
  expect(
    authenticateClient(
      new Request(url, { headers: { Authorization: header } }),
      { client_id: client.id },
      [client],
    ).isErr(),
  ).toBe(true);
});
it("rejects omitted client secrets and duplicate form parameters", async () => {
  expect(
    authenticateClient(new Request(url), { client_id: client.id }, [
      client,
    ]).isErr(),
  ).toBe(true);
  const request = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "client_id=a&client_id=b",
  });
  expect((await readOAuthForm(request)).isErr()).toBe(true);
});
