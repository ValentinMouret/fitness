import { createCookie, redirect } from "react-router";
import { env } from "~/env.server";
import { isSafePath } from "~/utils";
import { isSessionValid, SESSION_COOKIE_NAME } from "../domain/session";

export const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: env.NODE_ENV === "production",
  secrets: [env.AUTH_SESSION_SECRET],
});

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  const publicUrl = new URL(request.url);
  if (env.NODE_ENV === "production") publicUrl.protocol = "https:";
  if (
    request.headers.get("Sec-Fetch-Site") === "cross-site" ||
    (origin !== null && origin !== publicUrl.origin)
  ) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export async function getUser(request: Request) {
  try {
    const value: unknown = await sessionCookie.parse(
      request.headers.get("Cookie"),
    );
    return isSessionValid(value, env.AUTH_USERNAME, Date.now())
      ? { username: env.AUTH_USERNAME }
      : null;
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request) {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\.data$/, "") + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(path)}`);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    requireSameOrigin(request);
  return user;
}

export async function loginWithCredentials(
  input: {
    readonly username: string;
    readonly password: string;
    readonly redirectTo?: string | null;
  },
  request: Request,
) {
  requireSameOrigin(request);
  if (
    input.username !== env.AUTH_USERNAME ||
    input.password !== env.AUTH_PASSWORD
  ) {
    return { error: "Invalid username or password" };
  }
  const destination =
    input.redirectTo && isSafePath(input.redirectTo)
      ? input.redirectTo
      : "/dashboard";
  return redirect(destination, {
    headers: {
      "Set-Cookie": await sessionCookie.serialize(
        {
          username: env.AUTH_USERNAME,
          expiresAt: Date.now() + env.AUTH_SESSION_TTL_SECONDS * 1000,
        },
        {
          maxAge: env.AUTH_SESSION_TTL_SECONDS,
          secure:
            new URL(request.url).protocol === "https:" ||
            env.NODE_ENV === "production",
        },
      ),
    },
  });
}

export async function logoutUser(request: Request) {
  requireSameOrigin(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }) },
  });
}
