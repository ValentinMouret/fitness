import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:tls";
import { expect, it } from "vitest";
import { createSmtpSignInEmail } from "./sign-in-email.server";

it("delivers over authenticated, certificate-verified TLS without logging the link", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fitness-smtp-test-"));
  const key = join(directory, "key.pem");
  const cert = join(directory, "cert.pem");
  const generated = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  expect(generated.status).toBe(0);
  let delivered = "";
  let authenticated = false;
  const server = createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    (socket) => {
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
          } else if (line.startsWith("EHLO"))
            socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
          else if (line.startsWith("AUTH PLAIN ")) {
            authenticated =
              Buffer.from(line.slice(11), "base64").toString() ===
              "\0fixture-user\0fixture-password";
            socket.write(
              authenticated ? "235 authenticated\r\n" : "535 refused\r\n",
            );
          } else if (line === "DATA") {
            inData = true;
            socket.write("354 send message\r\n");
          } else if (line === "QUIT") socket.end("221 bye\r\n");
          else
            socket.write(
              authenticated ? "250 ok\r\n" : "530 auth required\r\n",
            );
        }
      });
    },
  );
  server.on("tlsClientError", () => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing SMTP fixture address");
    const input = {
      host: "127.0.0.1",
      port: address.port,
      secure: true,
      requireTLS: false,
      from: "fitness@example.invalid",
      credentials: { user: "fixture-user", pass: "fixture-password" },
    };
    const message = {
      to: "invited@example.invalid",
      url: "https://fitness.example.invalid/api/auth/magic-link/verify?token=private-fixture-token",
    };
    await expect(createSmtpSignInEmail(input)(message)).rejects.toThrow(
      "Sign-in email delivery failed",
    );
    expect(delivered).toBe("");
    const source = `import { createSmtpSignInEmail } from './app/modules/auth/infra/sign-in-email.server.ts'; await createSmtpSignInEmail(${JSON.stringify(input)})(${JSON.stringify(message)});`;
    const child = spawn("bun", ["-e", source], {
      env: { ...process.env, NODE_EXTRA_CA_CERTS: cert },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (bytes) => {
      output += bytes.toString();
    });
    child.stderr.on("data", (bytes) => {
      output += bytes.toString();
    });
    const status = await new Promise<number | null>((resolve) =>
      child.on("close", resolve),
    );
    expect(status).toBe(0);
    expect(authenticated).toBe(true);
    expect(delivered).toContain("private-fixture-token");
    expect(delivered).toContain("From: fitness@example.invalid");
    expect(delivered).toContain("To: invited@example.invalid");
    expect(output).not.toContain("private-fixture-token");
    expect(output).not.toContain("fixture-password");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
