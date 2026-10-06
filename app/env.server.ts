import "dotenv/config";
import { z } from "zod";
import { oauthClientSchema } from "./modules/auth/domain/oauth";

const runtimeSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  GIT_SHA: z.string().optional(),
});

const databaseSchema = z.object({
  DATABASE_URL: z.string(),
  MCP_DATABASE_URL: z.url().optional(),
});

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
});

const sessionSchema = z.object({
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD: z.string().min(1),
  AUTH_SESSION_SECRET: z.string().min(32),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
});

const authFoundationSchema = z.object({
  AUTH_FOUNDATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  AUTH_FOUNDATION_ORIGIN: z.url().optional(),
  AUTH_FOUNDATION_OWNER_USER_ID: z.uuid().optional(),
  AUTH_LOCAL_INBOX: z.string().min(1).optional(),
  AUTH_SMTP_HOST: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+$/)
    .optional(),
  AUTH_SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  AUTH_SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  AUTH_SMTP_USER: z.string().min(1).optional(),
  AUTH_SMTP_PASSWORD: z.string().min(1).optional(),
  AUTH_SMTP_FROM: z.email().optional(),
  AUTH_INVITATION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604800),
});

const oauthSchema = z.object({
  OAUTH_ISSUER_URL: z.url().optional(),
  OAUTH_CLIENTS: z
    .string()
    .default("[]")
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "OAUTH_CLIENTS must be JSON",
        });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(oauthClientSchema)
        .refine(
          (clients) =>
            new Set(clients.map((client) => client.id)).size === clients.length,
          "OAuth client IDs must be unique",
        ),
    ),
  OAUTH_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OAUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  OAUTH_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2592000),
});

const schema = z
  .object({
    ...runtimeSchema.shape,
    ...databaseSchema.shape,
    ...anthropicSchema.shape,
    ...sessionSchema.shape,
    ...authFoundationSchema.shape,
    ...oauthSchema.shape,
  })
  .superRefine((value, ctx) => {
    if (value.AUTH_FOUNDATION_ENABLED) {
      const origin = value.AUTH_FOUNDATION_ORIGIN;
      const url = origin && new URL(origin);
      const validOrigin = url && url.origin === origin;
      const smtpValues = [
        value.AUTH_SMTP_HOST,
        value.AUTH_SMTP_PORT,
        value.AUTH_SMTP_SECURE,
        value.AUTH_SMTP_USER,
        value.AUTH_SMTP_PASSWORD,
        value.AUTH_SMTP_FROM,
      ];
      const production = value.NODE_ENV === "production";
      const validDelivery = production
        ? validOrigin &&
          url.protocol === "https:" &&
          !value.AUTH_LOCAL_INBOX &&
          smtpValues.every((setting) => setting !== undefined)
        : validOrigin &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
          !!value.AUTH_LOCAL_INBOX &&
          smtpValues.every((setting) => setting === undefined);
      if (!value.AUTH_FOUNDATION_OWNER_USER_ID || !validDelivery) {
        ctx.addIssue({
          code: "custom",
          message: production
            ? "Production auth requires an HTTPS origin, owner ID and complete SMTP settings; local inbox is forbidden."
            : "Local auth requires a loopback HTTP origin, owner ID and private inbox; SMTP settings are forbidden.",
        });
      }
    }
    if (!value.OAUTH_ISSUER_URL) {
      if (value.OAUTH_CLIENTS.length)
        ctx.addIssue({
          code: "custom",
          message: "OAUTH_ISSUER_URL is required with OAuth clients",
        });
      return;
    }
    const url = new URL(value.OAUTH_ISSUER_URL);
    const localHttp =
      value.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (!localHttp && url.protocol !== "https:") ||
      url.origin !== value.OAUTH_ISSUER_URL ||
      !value.OAUTH_CLIENTS.length
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "OAuth requires an HTTPS origin without a trailing slash and configured clients (HTTP loopback allowed in development)",
      });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

export const env: ServerEnv = schema.parse(process.env);
