import type { User as BetterAuthUser } from "better-auth";
import { createAuthClient } from "better-auth/react";

export type User = BetterAuthUser;

export const authClient = createAuthClient();

export async function getUser(): Promise<User | null> {
  const session = await authClient.getSession();
  return session.data?.user ?? null;
}
