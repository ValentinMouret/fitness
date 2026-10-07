import { createServer } from "node:net";
import { expect, it } from "vitest";
import {
  createSmtpSignInEmail,
  type SignInEmail,
} from "./sign-in-email.server";

const emails: readonly SignInEmail[] = [
  {
    to: "invited@example.invalid",
    url: "http://localhost:5196/api/auth/magic-link/verify?token=fixture-token",
  },
  { to: "invited@example.invalid", code: "012345" },
  {
    to: "invited@example.invalid",
    invitationUrl: "http://localhost:5196/sign-in",
  },
];
it.each(
  emails.flatMap((message) =>
    [false, true].map((requireTLS) => ({ message, requireTLS })),
  ),
)(
  "loopback SMTP requireTLS=$requireTLS protects sign-in delivery",
  async ({ message, requireTLS }) => {
    let delivered = "";
    let recipient = "";
    const server = createServer((socket) => {
      socket.write("220 localhost ESMTP\r\n");
      let buffer = "";
      let inData = false;
      socket.on("data", (bytes) => {
        buffer += bytes.toString();
        while (buffer.includes("\r\n")) {
          const end = buffer.indexOf("\r\n");
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (inData && line !== ".") delivered += `${line}\n`;
          else if (inData) {
            inData = false;
            socket.write("250 queued\r\n");
          } else if (line === "STARTTLS")
            socket.write("502 TLS unavailable\r\n");
          else if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
          else if (/^RCPT TO:/i.test(line)) {
            recipient = line;
            socket.write("250 accepted\r\n");
          } else if (line === "DATA") {
            inData = true;
            socket.write("354 send message\r\n");
          } else if (line === "QUIT") {
            socket.end("221 bye\r\n");
          } else socket.write("250 ok\r\n");
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Missing SMTP fixture address");
      const delivery = createSmtpSignInEmail({
        host: "127.0.0.1",
        port: address.port,
        secure: false,
        requireTLS,
        from: "Fitness <fitness@example.invalid>",
      })(message);
      if (requireTLS) {
        await expect(delivery).rejects.toThrow("Sign-in email delivery failed");
        expect(recipient).toBe("");
        expect(delivered).toBe("");
        return;
      }
      await delivery;
      expect(recipient).toContain("invited@example.invalid");
      expect(delivered).toContain("Subject: Sign in to Fitness");
      if ("code" in message) {
        expect(delivered).toContain("012345");
        expect(delivered).toContain("five minutes");
        expect(delivered).not.toContain("http://");
      } else if ("invitationUrl" in message) {
        expect(delivered).toContain(message.invitationUrl);
        expect(delivered).toContain("request a sign-in code");
        expect(delivered).not.toContain("five minutes");
      } else {
        expect(delivered).toContain("fixture-token");
        expect(delivered).toContain("five minutes");
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
