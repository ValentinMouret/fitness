import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import type { Pool } from "pg";
import {
  invitationAllowsSignIn,
  invitedEmailSchema,
} from "../domain/invitation";
import { createInvitationRepository } from "./invitation.repository.server";

export function createMagicLinkAuth(input: {
  readonly pool: Pool;
  readonly origin: string;
  readonly secret: string;
  readonly ownerUserId: string;
  readonly sendEmail: (message: {
    readonly to: string;
    readonly url: string;
  }) => Promise<void>;
}) {
  const invitations = createInvitationRepository(input.pool, input.ownerUserId);
  const fields = { createdAt: "created_at", updatedAt: "updated_at" };
  const auth = betterAuth({
    database: input.pool,
    baseURL: input.origin,
    secret: input.secret,
    logger: { disabled: true },
    rateLimit: {
      enabled: true,
      customRules: {
        "/sign-in/magic-link": { window: 60, max: 10 },
        "/magic-link/verify": { window: 60, max: 30 },
      },
    },
    advanced: {
      database: { generateId: () => randomUUID() },
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    user: {
      modelName: "auth_users",
      fields: { ...fields, emailVerified: "email_verified" },
    },
    session: {
      modelName: "auth_sessions",
      cookieCache: { enabled: false },
      fields: {
        ...fields,
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
      },
    },
    account: {
      modelName: "auth_accounts",
      fields: {
        ...fields,
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
      },
    },
    verification: {
      modelName: "auth_verifications",
      fields: { ...fields, expiresAt: "expires_at" },
    },
    emailAndPassword: { enabled: false },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const invitation = await invitations.findByUserId(session.userId);
            return invitationAllowsSignIn(
              invitation,
              invitation?.email ?? "",
              new Date(),
            );
          },
          after: async (session) => {
            await invitations.finalizeSession({
              userId: session.userId,
              sessionId: session.id,
            });
          },
        },
      },
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        expiresIn: 300,
        sendMagicLink: async ({ email, url }) => {
          const normalized = invitedEmailSchema.parse(email);
          const invitation = await invitations.findByEmail(normalized);
          if (invitationAllowsSignIn(invitation, normalized, new Date()))
            await input.sendEmail({ to: normalized, url });
        },
      }),
    ],
  });

  async function getAdmittedSession(headers: Headers) {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const invitation = await invitations.findByUserId(session.user.id);
    return invitationAllowsSignIn(invitation, session.user.email, new Date())
      ? session
      : null;
  }
  async function requestSignInLink(message: {
    readonly headers: Headers;
    readonly email: string;
  }) {
    const headers = new Headers(message.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    return auth.handler(
      new Request(new URL("/api/auth/sign-in/magic-link", input.origin), {
        method: "POST",
        headers,
        body: JSON.stringify({ email: message.email, callbackURL: "/sign-in" }),
      }),
    );
  }
  return { auth, invitations, getAdmittedSession, requestSignInLink };
}
