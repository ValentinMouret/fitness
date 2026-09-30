import { db } from "~/db";
import { env } from "~/env.server";
import { createMagicLinkAuth } from "./magic-link.server";
import { createLocalSignInInbox } from "./sign-in-email.server";

let runtime: ReturnType<typeof createMagicLinkAuth> | null = null;

export function getAuthFoundation() {
  if (!env.AUTH_FOUNDATION_ENABLED) return null;
  if (
    !env.AUTH_FOUNDATION_ORIGIN ||
    !env.AUTH_FOUNDATION_OWNER_USER_ID ||
    !env.AUTH_LOCAL_INBOX ||
    env.NODE_ENV === "production"
  )
    throw new Error("Auth foundation is not configured for local use");
  runtime ??= createMagicLinkAuth({
    pool: db.$client,
    origin: env.AUTH_FOUNDATION_ORIGIN,
    secret: env.AUTH_SESSION_SECRET,
    ownerUserId: env.AUTH_FOUNDATION_OWNER_USER_ID,
    sendEmail: createLocalSignInInbox({
      path: env.AUTH_LOCAL_INBOX,
      environment: env.NODE_ENV,
    }),
  });
  return runtime;
}
