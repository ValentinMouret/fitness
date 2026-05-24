import type { User } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redirect } from "react-router";

import { env } from "~/env.server";
import { db } from "./db";
import * as authSchema from "./db/auth-schema";

export function authenticate(username: string, password: string): boolean {
  return username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
});

export async function getSessionUser(request: Request): Promise<User | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return session?.user ?? null;
}

export async function requireAuth(request: Request): Promise<User> {
  const user = await getSessionUser(request);

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;

    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}
