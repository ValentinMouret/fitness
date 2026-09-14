import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "~/env.server";
import {
  getUser,
  loginWithCredentials,
  requireAuth,
  sessionCookie,
} from "./session.server";

const request = (cookie = "", method = "GET", origin?: string) =>
  new Request("http://localhost/dashboard", {
    method,
    headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("browser sessions", () => {
  it("rejects unsigned, malformed, and signed wrong-owner cookies", async () => {
    for (const value of [
      "%E0%A4%A",
      encodeURIComponent(JSON.stringify({ username: env.AUTH_USERNAME })),
    ]) {
      expect(await getUser(request(`fitness-rr-session=${value}`))).toBeNull();
    }
    const cookie = await sessionCookie.serialize({
      username: "other",
      expiresAt: Date.now() + 10000,
    });
    expect(await getUser(request(cookie))).toBeNull();
  });
  it("checks expiry on the server even when the browser sends an expired cookie", async () => {
    vi.useFakeTimers();
    const response = await loginWithCredentials(
      { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD },
      request(),
    );
    if (!(response instanceof Response))
      throw new Error("Expected login response");
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(await getUser(request(cookie))).toEqual({
      username: env.AUTH_USERNAME,
    });
    vi.advanceTimersByTime(env.AUTH_SESSION_TTL_SECONDS * 1000);
    expect(await getUser(request(cookie))).toBeNull();
  });
  it("rejects cross-origin writes before application work", async () => {
    const cookie = await sessionCookie.serialize({
      username: env.AUTH_USERNAME,
      expiresAt: Date.now() + 10000,
    });
    await expect(
      requireAuth(request(cookie, "POST", "https://other.example")),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("accepts HTTPS browser writes through the production HTTP proxy", async () => {
    vi.spyOn(env, "NODE_ENV", "get").mockReturnValue("production");
    const response = await loginWithCredentials(
      { username: env.AUTH_USERNAME, password: env.AUTH_PASSWORD },
      new Request("http://fitness.example/login", {
        method: "POST",
        headers: {
          Origin: "https://fitness.example",
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Host": "fitness.example",
        },
      }),
    );
    if (!(response instanceof Response))
      throw new Error("Expected login response");
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("Secure");
    await expect(
      requireAuth(
        new Request("http://fitness.example/dashboard", {
          method: "POST",
          headers: { Cookie: cookie, Origin: "https://fitness.example" },
        }),
      ),
    ).resolves.toEqual({ username: env.AUTH_USERNAME });
    for (const origin of ["https://evil.example", "http://fitness.example"]) {
      await expect(
        requireAuth(
          new Request("http://fitness.example/dashboard", {
            method: "POST",
            headers: {
              Cookie: cookie,
              Origin: origin,
              "X-Forwarded-Host": "evil.example",
              "X-Forwarded-Proto": "http",
            },
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    }
  });
  it("does not follow external redirects after login", async () => {
    for (const redirectTo of [
      "//evil.test",
      "/\\evil.test",
      "/ \n/evil.test",
    ]) {
      const response = await loginWithCredentials(
        {
          username: env.AUTH_USERNAME,
          password: env.AUTH_PASSWORD,
          redirectTo,
        },
        request(),
      );
      if (!(response instanceof Response))
        throw new Error("Expected login response");
      expect(response.headers.get("Location")).toBe("/dashboard");
    }
  });
});
