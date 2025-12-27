import { env } from "~/env.server";

export function authenticate(username: string, password: string): boolean {
  return username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD;
}
