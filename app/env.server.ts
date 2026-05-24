import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ANTHROPIC_API_KEY: z.string(),
    ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
    AUTH_USERNAME: z.string(),
    AUTH_PASSWORD: z.string(),
    BETTER_AUTH_SECRET: z.string().optional(),
    BETTER_AUTH_URL: z.url().optional(),
    DATABASE_URL: z.string(),
    GIT_SHA: z.string().optional(),
    PORT: z.coerce.number().default(5173),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET is required in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof schema> & {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
};

const parsedEnv = schema.parse(process.env);

export const env: ServerEnv = {
  ...parsedEnv,
  BETTER_AUTH_SECRET:
    parsedEnv.BETTER_AUTH_SECRET ?? "development-better-auth-secret",
  BETTER_AUTH_URL:
    parsedEnv.BETTER_AUTH_URL ?? `http://localhost:${parsedEnv.PORT}`,
};
