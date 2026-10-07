import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { runWithTransaction } from "@better-auth/core/context";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  formCsrfMiddleware,
} from "better-auth/api";
import { emailOTP, magicLink } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { z } from "zod";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
} from "~/db/schema";
import { logger } from "~/logger.server";
import {
  invitationAllowsSignIn,
  invitedEmailSchema,
} from "../domain/invitation";
import { createInvitationRepository } from "./invitation.repository.server";
import type { SignInEmail } from "./sign-in-email.server";

export function createMagicLinkAuth(input: {
  readonly pool: Pool;
  readonly origin: string;
  readonly secret: string;
  readonly ownerUserId: string;
  readonly sendEmail: (message: SignInEmail) => Promise<void>;
}) {
  const database = drizzle(input.pool);
  const transactionDatabase = new AsyncLocalStorage<
    Pick<typeof database, "select">
  >();
  const invitations = createInvitationRepository(
    input.pool,
    input.ownerUserId,
    () => transactionDatabase.getStore(),
  );
  const adapterConfig = {
    provider: "pg",
    schema: {
      auth_users: authUsers,
      auth_sessions: authSessions,
      auth_accounts: authAccounts,
      auth_verifications: authVerifications,
    },
    transaction: true,
  } as const;
  const signInCodePlugin = emailOTP({
    disableSignUp: true,
    otpLength: 6,
    expiresIn: 300,
    allowedAttempts: 3,
    storeOTP: {
      hash: async (code) =>
        createHmac("sha256", input.secret)
          .update("fitness:sign-in-code:")
          .update(code)
          .digest("base64url"),
    },
    resendStrategy: "rotate",
    rateLimit: { window: 60, max: 3 },
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (type !== "sign-in") return;
      const normalized = invitedEmailSchema.parse(email);
      const invitation = await invitations.findByEmail(normalized);
      if (invitationAllowsSignIn(invitation, normalized, new Date())) {
        void input.sendEmail({ to: normalized, code: otp }).catch(() => {
          logger.warn("Sign-in email delivery failed");
        });
      }
    },
  });
  const auth = betterAuth({
    database: drizzleAdapter(database, adapterConfig),
    baseURL: input.origin,
    secret: input.secret,
    logger: { disabled: true },
    disabledPaths: [
      "/sign-in/magic-link",
      "/email-otp/create-verification-otp",
      "/email-otp/get-verification-otp",
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/forget-password/email-otp",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
    ],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (
          context.path === "/email-otp/send-verification-otp" ||
          context.path === "/sign-in/email-otp"
        ) {
          await formCsrfMiddleware(context);
        }
        if (context.path === "/email-otp/send-verification-otp") {
          const parsed = z
            .object({ email: invitedEmailSchema, type: z.literal("sign-in") })
            .safeParse(context.body);
          if (!parsed.success)
            throw new APIError("BAD_REQUEST", {
              message: "Invalid sign-in request.",
            });
          return { context: { body: parsed.data } };
        }
        if (context.path === "/sign-in/email-otp") {
          const parsed = z
            .object({
              email: invitedEmailSchema,
              otp: z.string().regex(/^[0-9]{6}$/),
            })
            .safeParse(context.body);
          if (!parsed.success)
            throw APIError.from(
              "BAD_REQUEST",
              signInCodePlugin.$ERROR_CODES.INVALID_OTP,
            );
          const invitation = await invitations.findByEmail(parsed.data.email);
          if (
            !invitationAllowsSignIn(invitation, parsed.data.email, new Date())
          )
            throw APIError.from(
              "BAD_REQUEST",
              signInCodePlugin.$ERROR_CODES.INVALID_OTP,
            );
          return { context: { body: parsed.data } };
        }
      }),
    },
    rateLimit: {
      enabled: true,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 3 },
        "/magic-link/verify": { window: 60, max: 30 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
      database: { generateId: () => randomUUID() },
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    user: {
      modelName: "auth_users",
    },
    session: {
      modelName: "auth_sessions",
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "auth_accounts",
    },
    verification: {
      modelName: "auth_verifications",
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
      {
        ...signInCodePlugin,
        endpoints: {
          ...signInCodePlugin.endpoints,
          sendVerificationOTP: createAuthEndpoint(
            signInCodePlugin.endpoints.sendVerificationOTP.path,
            signInCodePlugin.endpoints.sendVerificationOTP.options,
            (context) =>
              serializeCodeRequest(context.body.email, () =>
                signInCodePlugin.endpoints.sendVerificationOTP({
                  ...context,
                  asResponse: true,
                }),
              ),
          ),
          signInEmailOTP: createAuthEndpoint(
            signInCodePlugin.endpoints.signInEmailOTP.path,
            signInCodePlugin.endpoints.signInEmailOTP.options,
            (context) =>
              serializeCodeRequest(context.body.email, () =>
                signInCodePlugin.endpoints.signInEmailOTP({
                  ...context,
                  asResponse: true,
                }),
              ),
          ),
        },
      },
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

  async function serializeCodeRequest(
    email: string,
    operation: () => Promise<Response>,
  ): Promise<Response> {
    const normalized = invitedEmailSchema.parse(email);
    const context = await auth.$context;
    // Lock and OTP writes share a transaction; a wrong-code response commits attempts.
    return runWithTransaction(
      {
        ...context.adapter,
        transaction: (callback) =>
          database.transaction(async (tx) => {
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`fitness:sign-in-code:${normalized}`}, 0))`,
            );
            return transactionDatabase.run(tx, () =>
              callback(
                drizzleAdapter(tx, { ...adapterConfig, transaction: false })(
                  context.options,
                ),
              ),
            );
          }),
      },
      operation,
    );
  }

  async function getAdmittedSession(headers: Headers) {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const invitation = await invitations.findByUserId(session.user.id);
    return invitationAllowsSignIn(invitation, session.user.email, new Date())
      ? session
      : null;
  }
  function signInRequest(
    headersInput: Headers,
    path: string,
    body: Readonly<Record<string, string>>,
  ) {
    const headers = new Headers(headersInput);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    return auth.handler(
      new Request(new URL(`/api/auth${path}`, input.origin), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
  }
  function requestSignInCode(message: {
    readonly headers: Headers;
    readonly email: string;
  }) {
    return signInRequest(message.headers, "/email-otp/send-verification-otp", {
      email: message.email,
      type: "sign-in",
    });
  }
  function verifySignInCode(message: {
    readonly headers: Headers;
    readonly email: string;
    readonly code: string;
  }) {
    return signInRequest(message.headers, "/sign-in/email-otp", {
      email: message.email,
      otp: message.code,
    });
  }
  async function sendInvitationEmail(message: { readonly email: string }) {
    const invitation = await invitations.findByEmail(message.email);
    if (!invitationAllowsSignIn(invitation, message.email, new Date()))
      throw new Error("Invitation is unavailable");
    await input.sendEmail({
      to: message.email,
      invitationUrl: new URL("/sign-in", input.origin).href,
    });
  }
  return {
    auth,
    invitations,
    getAdmittedSession,
    requestSignInCode,
    verifySignInCode,
    sendInvitationEmail,
  };
}
