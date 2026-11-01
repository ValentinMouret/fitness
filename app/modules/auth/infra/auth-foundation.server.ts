import { db } from "~/db";
import { env } from "~/env.server";
import { createMagicLinkAuth } from "./magic-link.server";
import {
  createLocalSignInInbox,
  createResendSignInEmail,
  createSmtpSignInEmail,
} from "./sign-in-email.server";

let runtime: ReturnType<typeof createMagicLinkAuth> | null = null;

export function getAuthFoundation() {
  if (!env.AUTH_FOUNDATION_ENABLED) return null;
  if (!env.AUTH_FOUNDATION_ORIGIN || !env.AUTH_FOUNDATION_OWNER_USER_ID)
    throw new Error("Auth foundation is not configured");
  if (runtime) return runtime;
  let sendEmail: ReturnType<typeof createSmtpSignInEmail>;
  const from = env.AUTH_EMAIL_FROM ?? env.AUTH_SMTP_FROM;
  if (env.NODE_ENV === "production" && env.RESEND_API_KEY) {
    if (!from) throw new Error("Production auth email is not configured");
    sendEmail = createResendSignInEmail({ apiKey: env.RESEND_API_KEY, from });
  } else if (env.NODE_ENV === "production") {
    if (
      !env.AUTH_SMTP_HOST ||
      !env.AUTH_SMTP_PORT ||
      env.AUTH_SMTP_SECURE === undefined ||
      !env.AUTH_SMTP_USER ||
      !env.AUTH_SMTP_PASSWORD ||
      !from ||
      env.AUTH_LOCAL_INBOX
    )
      throw new Error("Production auth email is not configured");
    sendEmail = createSmtpSignInEmail({
      host: env.AUTH_SMTP_HOST,
      port: env.AUTH_SMTP_PORT,
      secure: env.AUTH_SMTP_SECURE,
      requireTLS: !env.AUTH_SMTP_SECURE,
      from,
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
