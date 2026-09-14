import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { snapshot, storageSettings } from "../support/database";
import {
  authorize,
  clients,
  discover,
  exchange,
  revoke,
  tokens,
} from "../support/oauth";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test("consent and tokens persist in PostgreSQL without plaintext bearer tokens @storage", async ({
  page,
  request,
}) => {
  const metadata = await discover(request);
  const settings = storageSettings();
  const grant = await authorize(page, metadata, clients[0]);
  const connections = await snapshot(settings.E2E_CONNECTIONS_TABLE);
  const codes = await snapshot(settings.E2E_AUTHORIZATION_CODES_TABLE);
  expect(connections.length).toBeGreaterThan(0);
  const serializedCodes = JSON.stringify(codes);
  const codeHash = createHash("sha256").update(grant.code).digest("hex");
  expect(
    serializedCodes.includes(grant.code) || serializedCodes.includes(codeHash),
    "Issued code must be persisted until exchange",
  ).toBe(true);
  const pair = await tokens(
    await exchange(request, metadata, clients[0], grant),
  );
  try {
    const serializedTokens = JSON.stringify(
      await snapshot(settings.E2E_TOKENS_TABLE),
    );
    for (const token of [pair.access_token, pair.refresh_token]) {
      expect(
        serializedTokens.includes(token),
        "Raw bearer token persisted in token storage",
      ).toBe(false);
      const hash = createHash("sha256").update(token).digest("hex");
      expect(
        serializedTokens.includes(hash),
        "Token storage must contain the issued token's SHA-256 digest",
      ).toBe(true);
    }
    const persisted = JSON.stringify([
      ...(await snapshot(settings.E2E_CONNECTIONS_TABLE)),
      ...(await snapshot(settings.E2E_AUTHORIZATION_CODES_TABLE)),
    ]);
    expect(
      persisted.includes(pair.access_token) ||
        persisted.includes(pair.refresh_token),
      "Raw bearer token persisted outside token storage",
    ).toBe(false);
  } finally {
    await revoke(request, metadata, clients[0], pair.refresh_token);
  }
});
