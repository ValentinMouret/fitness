import { z } from "zod";

const schema = z.object({
  // VITE_* prefixed vars go here
  // Example: VITE_PUBLIC_API_URL: z.string(),
});

export type ClientEnv = z.infer<typeof schema>;

export const env: ClientEnv = schema.parse(import.meta.env);
