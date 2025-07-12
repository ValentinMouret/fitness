import { redirect } from "react-router";

export interface User {
  readonly username: string;
}

const SESSION_KEY = "fitness-rr-auth";
const COOKIE_NAME = "fitness-rr-session";

function getCookie(name: string, cookieString?: string): string | null {
  if (typeof document === "undefined" && !cookieString) {
    return null;
  }

  const cookies = (cookieString ?? document.cookie).split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

function setCookie(name: string, value: string, days = 7): void {
  if (typeof document !== "undefined") {
    const expires = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000,
    ).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
  }
}

function deleteCookie(name: string): void {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

export function getUser(request?: Request): User | null {
  const cookieHeader = request?.headers.get("Cookie");
  const sessionCookie = getCookie(COOKIE_NAME, cookieHeader || undefined);

  if (sessionCookie) {
    try {
      return JSON.parse(sessionCookie);
    } catch {
      // Invalid cookie data
    }
  }

  // Fallback to sessionStorage (client-side only)
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  return null;
}

export function setUser(user: User): void {
  // Set both cookie and sessionStorage
  setCookie(COOKIE_NAME, JSON.stringify(user));

  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

export function clearUser(): void {
  deleteCookie(COOKIE_NAME);

  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
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

export function requireAuth(request?: Request): User {
  const user = getUser(request);

  if (!user) {
    const url = request ? new URL(request.url) : null;
    const redirectTo = url ? url.pathname + url.search : "/";

    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}

export async function logout(): Promise<Response> {
  clearUser();
  return redirect("/login");
}
