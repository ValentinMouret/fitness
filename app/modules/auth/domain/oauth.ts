import { err, ok } from "neverthrow";
import { z } from "zod";

export const FITNESS_SCOPE = "fitness";
export const oauthClientSchema = z.object({
  name: z.string().min(1).max(80),
  id: z.string().min(1).max(200),
  secret: z.string().min(16),
  redirectUri: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.hash &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  }, "Callback must use HTTPS (HTTP loopback is allowed)"),
});
export type OAuthClient = Readonly<z.infer<typeof oauthClientSchema>>;

export const authorizationSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.url(),
  scope: z.literal(FITNESS_SCOPE),
  resource: z.url(),
  state: z
    .string()
    .min(1)
    .max(1024)
    .regex(/^[\x20-\x7e]+$/)
    .optional(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
});
export type Authorization = Readonly<z.infer<typeof authorizationSchema>>;
export type OAuthFailure =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "invalid_target"
  | "unsupported_grant_type"
  | "server_error";

export function validateAuthorization(
  input: unknown,
  clients: readonly OAuthClient[],
  resource: string,
) {
  const parsed = authorizationSchema.safeParse(input);
  if (!parsed.success) return err<never, OAuthFailure>("invalid_request");
  const params = parsed.data;
  const client = clients.find((client) => client.id === params.client_id);
  if (!client || client.redirectUri !== params.redirect_uri)
    return err<never, OAuthFailure>("invalid_request");
  if (params.resource !== resource)
    return err<never, OAuthFailure>("invalid_target");
  return ok({ params, client });
}

export function connectionIsActive(
  connection: {
    readonly revokedAt: Date | null;
    readonly resource: string;
    readonly scope: string;
  },
  resource: string,
) {
  return (
    connection.revokedAt === null &&
    connection.resource === resource &&
    connection.scope === FITNESS_SCOPE
  );
}
