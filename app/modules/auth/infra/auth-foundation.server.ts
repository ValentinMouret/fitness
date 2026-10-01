import { db } from "~/db";
import { env } from "~/env.server";
import { createMagicLinkAuth } from "./magic-link.server";
import {
  createLocalSignInInbox,
  createSmtpSignInEmail,
} from "./sign-in-email.server";

let runtime: ReturnType<typeof createMagicLinkAuth> | null = null;

export function getAuthFoundation() {
  if (!env.AUTH_FOUNDATION_ENABLED) return null;
  if (!env.AUTH_FOUNDATION_ORIGIN || !env.AUTH_FOUNDATION_OWNER_USER_ID)
    throw new Error("Auth foundation is not configured");
  if (runtime) return runtime;
  let sendEmail: ReturnType<typeof createSmtpSignInEmail>;
  if (env.NODE_ENV === "production") {
    if (
      !env.AUTH_SMTP_HOST ||
      !env.AUTH_SMTP_PORT ||
      env.AUTH_SMTP_SECURE === undefined ||
      !env.AUTH_SMTP_USER ||
      !env.AUTH_SMTP_PASSWORD ||
      !env.AUTH_SMTP_FROM ||
      env.AUTH_LOCAL_INBOX
    )
      throw new Error("Production auth email is not configured");
    sendEmail = createSmtpSignInEmail({
      host: env.AUTH_SMTP_HOST,
      port: env.AUTH_SMTP_PORT,
      secure: env.AUTH_SMTP_SECURE,
      requireTLS: !env.AUTH_SMTP_SECURE,
      from: env.AUTH_SMTP_FROM,
      credentials: { user: env.AUTH_SMTP_USER, pass: env.AUTH_SMTP_PASSWORD },
    });
  } else {
    if (!env.AUTH_LOCAL_INBOX)
      throw new Error("Local auth inbox is not configured");
    sendEmail = createLocalSignInInbox({
      path: env.AUTH_LOCAL_INBOX,
      environment: env.NODE_ENV,
    });
  }
  runtime = createMagicLinkAuth({
    pool: db.$client,
    origin: env.AUTH_FOUNDATION_ORIGIN,
    secret: env.AUTH_SESSION_SECRET,
    ownerUserId: env.AUTH_FOUNDATION_OWNER_USER_ID,
    sendEmail,
  });
  return runtime;
}
