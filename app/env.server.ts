import { z } from "zod";

const schema = z.object({
  ANTHROPIC_API_KEY: z.string(),
  AUTH_USERNAME: z.string(),
  AUTH_PASSWORD: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(5173),
});

export type ServerEnv = z.infer<typeof schema>;

export const env: ServerEnv = schema.parse(process.env);
