import { createServer, type RequestListener } from "node:http";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  createResendSignInEmail,
  type SignInEmail,
} from "./sign-in-email.server";

const apiKey = "fixture-resend-secret";
const from = "fitness@example.invalid";
const emailId = "720cbf7c-67b5-4d6b-b026-c8e1099ff435";
const message: SignInEmail = { to: "invited@example.invalid", code: "012345" };

async function withEmailServer(
  handler: RequestListener,
  check: (send: (email: SignInEmail) => Promise<void>) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server");
  const send = createResendSignInEmail({ apiKey, from }, (url, init) => {
    expect(url).toBe("https://api.resend.com/emails");
    return fetch(`http://127.0.0.1:${address.port}/emails`, init);
  });
  try {
    await check(send);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

it("sends codes, invitations and retained links through the authenticated JSON API", async () => {
  const received: {
    readonly authorization: string | undefined;
    readonly method: string | undefined;
    readonly body: string;
  }[] = [];
  await withEmailServer(
    (request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        received.push({
          authorization: request.headers.authorization,
          method: request.method,
          body,
        });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ id: emailId }));
      });
    },
    async (send) => {
      await send(message);
      await send({
        to: message.to,
        invitationUrl: "https://fitness.example.invalid/sign-in",
      });
      await send({
        to: message.to,
        url: "https://fitness.example.invalid/verify?token=fixture",
      });
    },
  );
  expect(received).toHaveLength(3);
  const texts = received.map((request) => {
    expect(request.authorization).toBe(`Bearer ${apiKey}`);
    expect(request.method).toBe("POST");
    const body = z
      .object({
        from: z.string(),
        to: z.array(z.string()),
        subject: z.string(),
        text: z.string(),
      })
      .parse(JSON.parse(request.body));
    expect(body.from).toBe(from);
    expect(body.to).toEqual([message.to]);
    expect(body.subject).toBe("Sign in to Fitness");
    return body.text;
  });
  expect(texts[0]).toContain("012345");
  expect(texts[0]).toContain("five minutes");
  expect(texts[0]).not.toContain("https://");
  expect(texts[1]).toContain("request a sign-in code");
  expect(texts[1]).toContain("https://fitness.example.invalid/sign-in");
  expect(texts[2]).toContain(
    "https://fitness.example.invalid/verify?token=fixture",
  );
});

it.each([
  { status: 401, body: apiKey },
  { status: 429, body: apiKey },
  { status: 500, body: apiKey },
  { status: 200, body: "not JSON" },
  { status: 200, body: JSON.stringify({ message: apiKey }) },
])(
  "fails safely on provider response $status/$body",
  async ({ status, body }) => {
    await withEmailServer(
      (_request, response) => {
        response.writeHead(status);
        response.end(body);
      },
      async (send) => {
        await expect(send(message)).rejects.toThrow(
          /^Sign-in email delivery failed$/,
        );
      },
    );
  },
);

it("never follows a provider redirect with the sign-in payload", async () => {
  let requests = 0;
  await withEmailServer(
    (_request, response) => {
      requests++;
      response.writeHead(307, { Location: "/redirected" });
      response.end();
    },
    async (send) => {
      await expect(send(message)).rejects.toThrow(
        /^Sign-in email delivery failed$/,
      );
    },
  );
  expect(requests).toBe(1);
});

it("bounds an unresponsive provider request", async () => {
  await withEmailServer(
    () => {},
    async (send) => {
      await expect(send(message)).rejects.toThrow(
        /^Sign-in email delivery failed$/,
      );
    },
  );
}, 20_000);
