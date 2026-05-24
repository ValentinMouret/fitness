import { redirect } from "react-router";
import { auth } from "~/auth.server";
import { isSafePath } from "~/utils";

export type LoginResult = { error: string } | Response;

async function authRequest(
  request: Request,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  const cookie = request.headers.get("cookie");
  const origin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent");
  if (cookie) headers.set("cookie", cookie);
  if (origin) headers.set("origin", origin);
  if (userAgent) headers.set("user-agent", userAgent);

  return auth.handler(
    new Request(new URL(path, request.url), {
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
      method: "POST",
    }),
  );
}

async function readAuthError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined);
  return body?.message ?? "Authentication failed";
}

export async function loginWithCredentials(input: {
  readonly email: string;
  readonly password: string;
  readonly request: Request;
  readonly redirectTo?: string | null;
}): Promise<LoginResult> {
  const { email, password, redirectTo, request } = input;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const authResponse = await authRequest(request, "/api/auth/sign-in/email", {
    email,
    password,
  });

  if (!authResponse.ok) {
    return { error: await readAuthError(authResponse) };
  }

  const safeRedirectTo =
    redirectTo && isSafePath(redirectTo) ? redirectTo : "/habits";
  const cookie = authResponse.headers.get("set-cookie");

  return redirect(safeRedirectTo, {
    headers: cookie ? { "Set-Cookie": cookie } : undefined,
  });
}

export async function logoutUser(request: Request): Promise<Response> {
  const authResponse = await authRequest(request, "/api/auth/sign-out");
  const cookie = authResponse.headers.get("set-cookie");

  return redirect("/login", {
    headers: cookie ? { "Set-Cookie": cookie } : undefined,
  });
}
