import { expect, test } from "@playwright/test";
import {
  expectUnauthenticated,
  loginWithRequest,
  sessionCookieName,
} from "../support/auth";
import {
  authorize,
  clients,
  discover,
  exchange,
  expectMcpAccess,
  expectMcpDenied,
  expectOAuthError,
  expirySeconds,
  refresh,
  revoke,
  tokens,
} from "../support/oauth";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test.describe("short server lifetimes @expiry", () => {
  test("server rejects an expired, unmodified cookie even when sent manually @session-expiry", async ({
    request,
    playwright,
    baseURL,
  }) => {
    const cookie = await loginWithRequest(request);
    const remaining = cookie.expires * 1000 - Date.now();
    expect(
      remaining,
      "Configure the test server session lifetime within E2E_EXPIRY_SECONDS",
    ).toBeLessThanOrEqual(expirySeconds * 1000);
    expect(remaining).toBeGreaterThan(0);
    const attacker = await playwright.request.newContext({ baseURL });
    try {
      const headers = { Cookie: `${sessionCookieName}=${cookie.value}` };
      expect(
        (
          await attacker.get("/dashboard", { headers, maxRedirects: 0 })
        ).status(),
      ).toBe(200);
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.max(0, cookie.expires * 1000 - Date.now()) + 100,
        ),
      );
      expectUnauthenticated(
        await attacker.get("/dashboard", { headers, maxRedirects: 0 }),
      );
    } finally {
      await attacker.dispose();
    }
  });

  test("an authorization code expires without being exchanged @code-expiry", async ({
    page,
    request,
  }) => {
    const metadata = await discover(request);
    const grant = await authorize(page, metadata, clients[0]);
    await new Promise((resolve) =>
      setTimeout(resolve, expirySeconds * 1000 + 100),
    );
    await expectOAuthError(
      await exchange(request, metadata, clients[0], grant),
      "invalid_grant",
    );
  });

  test("expired access is denied and a valid refresh token restores access @access-expiry", async ({
    page,
    request,
  }) => {
    const metadata = await discover(request);
    const pair = await tokens(
      await exchange(
        request,
        metadata,
        clients[0],
        await authorize(page, metadata, clients[0]),
      ),
    );
    try {
      expect(
        pair.expires_in,
        "Configure short access-token lifetime on the test server",
      ).toBeLessThanOrEqual(expirySeconds);
      await expectMcpAccess(request, pair.access_token);
      await new Promise((resolve) =>
        setTimeout(resolve, pair.expires_in * 1000 + 100),
      );
      await expectMcpDenied(request, pair.access_token);
      const rotated = await tokens(
        await refresh(request, metadata, clients[0], pair.refresh_token),
      );
      try {
        await expectMcpAccess(request, rotated.access_token);
      } finally {
        await revoke(request, metadata, clients[0], rotated.refresh_token);
      }
    } finally {
      await revoke(request, metadata, clients[0], pair.refresh_token);
    }
  });

  test("an expired refresh token cannot mint new credentials @refresh-expiry", async ({
    page,
    request,
  }) => {
    const metadata = await discover(request);
    const pair = await tokens(
      await exchange(
        request,
        metadata,
        clients[0],
        await authorize(page, metadata, clients[0]),
      ),
    );
    try {
      await expectMcpAccess(request, pair.access_token);
      await new Promise((resolve) =>
        setTimeout(resolve, expirySeconds * 1000 + 100),
      );
      await expectOAuthError(
        await refresh(request, metadata, clients[0], pair.refresh_token),
        "invalid_grant",
      );
    } finally {
      await revoke(request, metadata, clients[0], pair.refresh_token);
    }
  });
});
