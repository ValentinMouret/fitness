import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import nodemailer from "nodemailer";

export type SignInEmail = { readonly to: string } & (
  | { readonly url: string }
  | { readonly code: string }
  | { readonly invitationUrl: string }
);

export function createSmtpSignInEmail(input: {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly requireTLS: boolean;
  readonly from: string;
  readonly credentials?: { readonly user: string; readonly pass: string };
}) {
  const transport = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    requireTLS: input.requireTLS,
    auth: input.credentials,
    logger: false,
    debug: false,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return async (message: SignInEmail) => {
    try {
      await transport.sendMail({
        from: input.from,
        to: message.to,
        subject: "Sign in to Fitness",
        text:
          "code" in message
            ? `Enter this code in Fitness: ${message.code}\n\nIt expires in five minutes and can only be used once. Return to the Fitness app where you requested it.\n\nIf you did not request this email, ignore it.`
            : "invitationUrl" in message
              ? `You have been invited to Fitness. Open Fitness and request a sign-in code with this email address.\n\n${message.invitationUrl}`
              : `Use this link to sign in to Fitness. It expires in five minutes and can only be used once.\n\n${message.url}\n\nIf you did not request this email, ignore it.`,
      });
    } catch {
      throw new Error("Sign-in email delivery failed");
    }
  };
}

export function createLocalSignInInbox(input: {
  readonly path: string;
  readonly environment: "development" | "test";
}) {
  return async (message: SignInEmail) => {
    await mkdir(dirname(input.path), { recursive: true, mode: 0o700 });
    const file = await open(input.path, "a", 0o600);
    try {
      await file.chmod(0o600);
      await file.write(`${JSON.stringify(message)}\n`);
    } finally {
      await file.close();
    }
  };
}
