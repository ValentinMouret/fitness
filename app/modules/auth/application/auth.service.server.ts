import { redirect } from "react-router";
import type { User } from "~/auth";
import { authenticate } from "~/auth.server";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "../domain/session";

const SESSION_COOKIE_BASE = `${SESSION_COOKIE_NAME}=`;

function buildSessionCookie(user: User): string {
  return `${SESSION_COOKIE_BASE}${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Strict`;
}

function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_BASE}; Path=/; Max-Age=0; SameSite=Strict`;
}

export type LoginResult = { error: string } | Response;

export function loginWithCredentials(input: {
  readonly username: string;
  readonly password: string;
  readonly redirectTo?: string | null;
}): LoginResult {
  const { username, password, redirectTo } = input;

  if (!username || !password) {
    return { error: "Username and password are required" };
  }

  if (authenticate(username, password)) {
    const user: User = { username };
    return redirect(redirectTo || "/dashboard", {
      headers: {
        "Set-Cookie": buildSessionCookie(user),
      },
    });
  }

  return { error: "Invalid username or password" };
}

export function logoutUser(): Response {
  return redirect("/login", {
    headers: {
      "Set-Cookie": buildClearSessionCookie(),
    },
  });
}
