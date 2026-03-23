import { describe, expect, it, vi } from "vitest";

vi.mock("~/auth.server", () => ({
  authenticate: (username: string, password: string) =>
    username === "testuser" && password === "testpass",
}));

const { loginWithCredentials, logoutUser } = await import(
  "./auth.service.server"
);

describe("loginWithCredentials", () => {
  it("returns error when username is empty", () => {
    const result = loginWithCredentials({
      username: "",
      password: "testpass",
    });

    expect(result).toEqual({ error: "Username and password are required" });
  });

  it("returns error when password is empty", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "",
    });

    expect(result).toEqual({ error: "Username and password are required" });
  });

  it("returns error with invalid credentials", () => {
    const result = loginWithCredentials({
      username: "wrong",
      password: "wrong",
    });

    expect(result).toEqual({ error: "Invalid username or password" });
  });

  it("returns redirect response on valid credentials", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "testpass",
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard");
    expect(response.headers.get("Set-Cookie")).toContain("fitness-rr-session=");
    expect(response.headers.get("Set-Cookie")).toContain("testuser");
  });

  it("redirects to custom URL when redirectTo is provided", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "testpass",
      redirectTo: "/workouts",
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.headers.get("Location")).toBe("/workouts");
  });

  it("redirects to dashboard when redirectTo is null", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "testpass",
      redirectTo: null,
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("sets cookie with SameSite=Strict", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "testpass",
    });

    const response = result as Response;
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Strict");
  });

  it("sets cookie with Max-Age for 7 days", () => {
    const result = loginWithCredentials({
      username: "testuser",
      password: "testpass",
    });

    const response = result as Response;
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(response.headers.get("Set-Cookie")).toContain(
      `Max-Age=${sevenDaysInSeconds}`,
    );
  });
});

describe("logoutUser", () => {
  it("returns redirect to login page", () => {
    const result = logoutUser();

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("/login");
  });

  it("clears session cookie with Max-Age=0", () => {
    const result = logoutUser();

    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
