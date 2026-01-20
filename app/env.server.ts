import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  AUTH_USERNAME: z.string(),
  AUTH_PASSWORD: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(5173),
});

export type ServerEnv = z.infer<typeof schema>;

export const env: ServerEnv = schema.parse(process.env);
