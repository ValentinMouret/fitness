import { redirect } from "react-router";
import { Cookies } from "./cookies";
import { isServer } from "./utils";

export interface User {
  readonly username: string;
}

const SESSION_KEY = "fitness-rr-auth";
const COOKIE_NAME = "fitness-rr-session";

export async function getUser(request?: Request): Promise<User | null> {
  const cookieHeader = request?.headers.get("Cookie");
  const sessionCookie = await Cookies.get(
    COOKIE_NAME,
    cookieHeader ?? undefined,
  );

  if (sessionCookie) {
    try {
      return JSON.parse(sessionCookie);
    } catch (err) {
      console.error("Failed to parse session cookie", err);
    }
  }

  if (isServer()) return null;

  const stored = sessionStorage.getItem(SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
}

export async function setUser(user: User): Promise<void> {
  await Cookies.set(COOKIE_NAME, JSON.stringify(user));

  if (isServer()) return;

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await Cookies.delete(COOKIE_NAME);

  if (isServer()) return;

  sessionStorage.removeItem(SESSION_KEY);
}

export function authenticate(username: string, password: string): boolean {
  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    throw new Error(
      "AUTH_USERNAME and AUTH_PASSWORD environment variables must be set",
    );
  }

  return username === expectedUsername && password === expectedPassword;
}

export async function requireAuth(request?: Request): Promise<User> {
  const user = await getUser(request);

  if (!user) {
    const url = request ? new URL(request.url) : null;
    const redirectTo = url ? url.pathname + url.search : "/";

    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}

export async function logout(): Promise<Response> {
  await clearUser();
  return redirect("/login");
}
