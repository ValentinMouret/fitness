import { z } from "zod";

export const SESSION_COOKIE_NAME = "fitness-rr-session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const sessionSchema = z.object({
  username: z.string(),
  expiresAt: z.number().int().positive(),
});

export function isSessionValid(
  value: unknown,
  username: string,
  now: number,
): boolean {
  const session = sessionSchema.safeParse(value);
  return (
    session.success &&
    session.data.username === username &&
    session.data.expiresAt > now
  );
}
