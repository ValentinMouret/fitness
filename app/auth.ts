import { redirect } from "react-router";
import { isServer } from "./utils";

export interface User {
  readonly username: string;
}

const SESSION_KEY = "fitness-rr-auth";
const COOKIE_NAME = "fitness-rr-session";

async function getCookie(
  name: string,
  cookieString?: string,
): Promise<string | null> {
  if (isServer() && !cookieString) {
    return null;
  }

  if (cookieString) {
    const cookies = cookieString.split(";");
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split("=");
      if (key === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  const cookie = await cookieStore.get(name);
  return cookie?.value ?? null;
}

async function setCookie(name: string, value: string, days = 7): Promise<void> {
  if (isServer()) {
    return;
  }

  await cookieStore.set({
    name,
    value: encodeURIComponent(value),
    expires: Date.now() + days * 24 * 60 * 60 * 1000,
    path: "/",
    sameSite: "strict",
  });
}

async function deleteCookie(name: string): Promise<void> {
  if (isServer()) return;

  await cookieStore.delete(name);
}

export async function getUser(request?: Request): Promise<User | null> {
  const cookieHeader = request?.headers.get("Cookie");
  const sessionCookie = await getCookie(COOKIE_NAME, cookieHeader ?? undefined);

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
  await setCookie(COOKIE_NAME, JSON.stringify(user));

  if (isServer()) return;

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await deleteCookie(COOKIE_NAME);

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
