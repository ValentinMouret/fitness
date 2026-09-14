import { expect, test } from "@playwright/test";
import {
  authorization,
  authorize,
  clientPost,
  clients,
  decide,
  discover,
  exchange,
  expectMcpAccess,
  expectMcpDenied,
  expectOAuthError,
  mcpResource,
  refresh,
  revoke,
  showConsent,
  tokens,
} from "../support/oauth";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test("MCP discovery advertises the Fitness resource and supported OAuth flow", async ({
  request,
}) => {
  await discover(request);
});

for (const token of [
  "",
  "not-a-token",
  "eyJhbGciOiJub25lIn0.eyJzY29wZSI6ImZpdG5lc3MifQ.",
]) {
  test(`MCP rejects ${token ? (token.startsWith("ey") ? "unsigned JWT" : "unknown token") : "empty bearer token"}`, async ({
    request,
  }) => {
    await expectMcpDenied(request, token);
  });
}

test("cross-site consent cannot authorize an app", async ({
  page,
  request,
}) => {
  const metadata = await discover(request);
  const transaction = authorization(metadata, clients[0]);
  await showConsent(page, transaction.url);
  const submission = await page
    .getByRole("button", { name: /^allow( access)?$/i })
    .evaluate((element) => {
      if (!(element instanceof HTMLButtonElement) || !element.form)
        throw new Error("Consent requires a form submit button");
      const form = new FormData(element.form, element);
      return {
        action: element.form.action,
        fields: Object.fromEntries(
          Array.from(form.entries()).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
      };
    });
  const response = await page.request.post(submission.action, {
    headers: {
      Origin: "https://attacker.invalid",
      "Sec-Fetch-Site": "cross-site",
    },
    form: submission.fields,
    maxRedirects: 0,
  });
  expect([400, 403]).toContain(response.status());
  expect(response.headers().location).toBeUndefined();
});

for (const client of clients) {
  test.describe(client.name, () => {
    test("login, explicit consent, code exchange, and authenticated MCP initialize", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const pair = await tokens(
        await exchange(request, metadata, client, grant),
      );
      try {
        await expectMcpAccess(request, pair.access_token);
        await expectMcpDenied(request, pair.refresh_token);
        await expectMcpDenied(request, grant.code);
      } finally {
        await revoke(request, metadata, client, pair.refresh_token);
      }
    });

    test("denial returns access_denied and the original state, without a code", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const transaction = authorization(metadata, client);
      await showConsent(page, transaction.url);
      const callback = await decide(page, client, false);
      expect(callback.searchParams.get("state")).toBe(transaction.state);
      expect(callback.searchParams.get("error")).toBe("access_denied");
      expect(callback.searchParams.has("code")).toBe(false);
      expect(callback.searchParams.has("access_token")).toBe(false);
    });

    for (const [label, overrides, expectedError] of [
      ["wrong PKCE", { code_verifier: "a".repeat(43) }, "invalid_grant"],
      ["empty PKCE", { code_verifier: "" }, "invalid_grant"],
      [
        "wrong callback",
        { redirect_uri: `${client.callback}/wrong` },
        "invalid_grant",
      ],
      [
        "different resource",
        { resource: "https://attacker.invalid/mcp" },
        "invalid_target",
      ],
    ] as const) {
      test(`code exchange rejects ${label}`, async ({ page, request }) => {
        const metadata = await discover(request);
        const grant = await authorize(page, metadata, client);
        await expectOAuthError(
          await exchange(request, metadata, client, grant, overrides),
          expectedError,
        );
      });
    }

    test("code cannot be redeemed by the other registered client", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const other = clients.find(({ id }) => id !== client.id);
      if (!other) throw new Error("Two distinct OAuth clients are required");
      await expectOAuthError(
        await exchange(request, metadata, other, grant, {
          redirect_uri: client.callback,
        }),
        "invalid_grant",
      );
    });

    test("code exchange requires valid client credentials", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const response = await exchange(
        request,
        metadata,
        { ...client, secret: "wrong-secret" },
        grant,
      );
      expect([400, 401]).toContain(response.status());
      expect((await response.json()).error).toBe("invalid_client");
    });

    test("a code can only be exchanged once", async ({ page, request }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const pair = await tokens(
        await exchange(request, metadata, client, grant),
      );
      try {
        await expectOAuthError(
          await exchange(request, metadata, client, grant),
          "invalid_grant",
        );
      } finally {
        await revoke(request, metadata, client, pair.refresh_token);
      }
    });

    test("concurrent code exchanges have exactly one winner", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const responses = await Promise.all([
        exchange(request, metadata, client, grant),
        exchange(request, metadata, client, grant),
      ]);
      expect(responses.map((response) => response.status()).sort()).toEqual([
        200, 400,
      ]);
      for (const response of responses) {
        if (response.status() === 200) {
          const pair = await tokens(response);
          await revoke(request, metadata, client, pair.refresh_token);
        } else await expectOAuthError(response, "invalid_grant");
      }
    });

    test("refresh rotates credentials and rejects replay", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const grant = await authorize(page, metadata, client);
      const original = await tokens(
        await exchange(request, metadata, client, grant),
      );
      const rotated = await tokens(
        await refresh(request, metadata, client, original.refresh_token),
      );
      try {
        expect(rotated.access_token === original.access_token).toBe(false);
        expect(rotated.refresh_token === original.refresh_token).toBe(false);
        await expectMcpAccess(request, rotated.access_token);
        await expectOAuthError(
          await refresh(request, metadata, client, original.refresh_token),
          "invalid_grant",
        );
        await expectOAuthError(
          await refresh(request, metadata, client, rotated.refresh_token),
          "invalid_grant",
        );
      } finally {
        await revoke(request, metadata, client, rotated.refresh_token);
      }
    });

    test("concurrent refreshes cannot both mint tokens", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const pair = await tokens(
        await exchange(
          request,
          metadata,
          client,
          await authorize(page, metadata, client),
        ),
      );
      const responses = await Promise.all([
        refresh(request, metadata, client, pair.refresh_token),
        refresh(request, metadata, client, pair.refresh_token),
      ]);
      expect(responses.map((response) => response.status()).sort()).toEqual([
        200, 400,
      ]);
      for (const response of responses) {
        if (response.status() === 200)
          await revoke(
            request,
            metadata,
            client,
            (await tokens(response)).refresh_token,
          );
        else await expectOAuthError(response, "invalid_grant");
      }
    });

    for (const [name, overrides, error] of [
      ["scope expansion", { scope: "fitness admin" }, "invalid_scope"],
      [
        "resource change",
        { resource: "https://attacker.invalid/mcp" },
        "invalid_target",
      ],
    ] as const) {
      test(`refresh rejects ${name}`, async ({ page, request }) => {
        const metadata = await discover(request);
        const pair = await tokens(
          await exchange(
            request,
            metadata,
            client,
            await authorize(page, metadata, client),
          ),
        );
        try {
          await expectOAuthError(
            await refresh(
              request,
              metadata,
              client,
              pair.refresh_token,
              overrides,
            ),
            error,
          );
        } finally {
          await revoke(request, metadata, client, pair.refresh_token);
        }
      });
    }

    test("revocation invalidates access, refresh, and an already initialized MCP session", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const pair = await tokens(
        await exchange(
          request,
          metadata,
          client,
          await authorize(page, metadata, client),
        ),
      );
      const session = await expectMcpAccess(request, pair.access_token);
      await revoke(request, metadata, client, pair.refresh_token);
      await expectMcpDenied(request, pair.access_token);
      await expectOAuthError(
        await refresh(request, metadata, client, pair.refresh_token),
        "invalid_grant",
      );
      const response = await request.post(mcpResource, {
        headers: {
          Authorization: `Bearer ${pair.access_token}`,
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-11-25",
          ...(session ? { "Mcp-Session-Id": session } : {}),
        },
        data: { jsonrpc: "2.0", id: 2, method: "ping" },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(401);
      await revoke(request, metadata, client, pair.refresh_token);
    });

    test("a refresh/revoke race leaves no usable credentials after revocation", async ({
      page,
      request,
    }) => {
      const metadata = await discover(request);
      const pair = await tokens(
        await exchange(
          request,
          metadata,
          client,
          await authorize(page, metadata, client),
        ),
      );
      const [response] = await Promise.all([
        refresh(request, metadata, client, pair.refresh_token),
        revoke(request, metadata, client, pair.refresh_token),
      ]);
      await expectMcpDenied(request, pair.access_token);
      await expectOAuthError(
        await refresh(request, metadata, client, pair.refresh_token),
        "invalid_grant",
      );
      if (response.status() === 200) {
        const rotated = await tokens(response);
        await expectMcpDenied(request, rotated.access_token);
        await expectOAuthError(
          await refresh(request, metadata, client, rotated.refresh_token),
          "invalid_grant",
        );
      } else await expectOAuthError(response, "invalid_grant");
    });
  });
}

for (const [label, overrides] of [
  ["unknown client", { client_id: "unregistered-client" }],
  ["missing PKCE challenge", { code_challenge: null }],
  ["missing PKCE method", { code_challenge_method: null }],
  ["plain PKCE", { code_challenge_method: "plain" }],
  ["unknown scope", { scope: "admin" }],
  ["mixed scopes", { scope: "fitness admin" }],
  ["wrong resource", { resource: "https://attacker.invalid/mcp" }],
  ["implicit flow", { response_type: "token" }],
] as const) {
  test(`authorization rejects ${label} before consent`, async ({
    page,
    request,
  }) => {
    const metadata = await discover(request);
    const transaction = authorization(metadata, clients[0], overrides);
    await page.route(`${clients[0].callback}*`, (route) =>
      route.fulfill({ body: "OAuth test callback" }),
    );
    const response = await page.goto(transaction.url);
    const destination = new URL(page.url());
    if (destination.origin === new URL(clients[0].callback).origin) {
      expect(destination.searchParams.has("error")).toBe(true);
      expect(destination.searchParams.has("code")).toBe(false);
      expect(destination.searchParams.get("state")).toBe(transaction.state);
    } else {
      expect(response?.status()).toBe(400);
    }
    await expect(
      page.getByRole("button", { name: /^allow( access)?$/i }),
    ).toHaveCount(0);
  });
}

for (const [label, change] of [
  [
    "host",
    (url: URL) => {
      url.hostname = "attacker.invalid";
    },
  ],
  [
    "scheme",
    (url: URL) => {
      url.protocol = "http:";
    },
  ],
  [
    "port",
    (url: URL) => {
      url.port = "8443";
    },
  ],
  [
    "path",
    (url: URL) => {
      url.pathname += "/extra";
    },
  ],
  [
    "trailing slash",
    (url: URL) => {
      url.pathname += "/";
    },
  ],
  [
    "query",
    (url: URL) => {
      url.searchParams.set("extra", "1");
    },
  ],
] as const) {
  test(`invalid callback ${label} produces a local error without redirecting`, async ({
    request,
  }) => {
    const metadata = await discover(request);
    const callback = new URL(clients[0].callback);
    change(callback);
    const transaction = authorization(metadata, clients[0], {
      redirect_uri: callback.href,
    });
    const response = await request.get(transaction.url, { maxRedirects: 0 });
    expect(response.status()).toBe(400);
    expect(response.headers().location).toBeUndefined();
  });
}

for (const grant_type of ["password", "client_credentials", "unknown"]) {
  test(`token endpoint rejects ${grant_type} grant`, async ({ request }) => {
    const metadata = await discover(request);
    await expectOAuthError(
      await clientPost(request, metadata, clients[0], metadata.token_endpoint, {
        grant_type,
      }),
      "unsupported_grant_type",
    );
  });
}

test("revoking ChatGPT leaves Claude active, and reconnecting cannot revive old tokens", async ({
  page,
  request,
}) => {
  const metadata = await discover(request);
  const chatgpt = await tokens(
    await exchange(
      request,
      metadata,
      clients[0],
      await authorize(page, metadata, clients[0]),
    ),
  );
  const claude = await tokens(
    await exchange(
      request,
      metadata,
      clients[1],
      await authorize(page, metadata, clients[1]),
    ),
  );
  try {
    await expectMcpAccess(request, chatgpt.access_token);
    await expectMcpAccess(request, claude.access_token);
    await revoke(request, metadata, clients[0], chatgpt.refresh_token);
    await expectMcpDenied(request, chatgpt.access_token);
    await expectMcpAccess(request, claude.access_token);
    const replacement = await tokens(
      await exchange(
        request,
        metadata,
        clients[0],
        await authorize(page, metadata, clients[0]),
      ),
    );
    try {
      await expectMcpAccess(request, replacement.access_token);
      await expectMcpDenied(request, chatgpt.access_token);
      await expectOAuthError(
        await refresh(request, metadata, clients[0], chatgpt.refresh_token),
        "invalid_grant",
      );
    } finally {
      await revoke(request, metadata, clients[0], replacement.refresh_token);
    }
  } finally {
    await revoke(request, metadata, clients[0], chatgpt.refresh_token);
    await revoke(request, metadata, clients[1], claude.refresh_token);
  }
});

test("another client cannot revoke or refresh a connection", async ({
  page,
  request,
}) => {
  const metadata = await discover(request);
  const pair = await tokens(
    await exchange(
      request,
      metadata,
      clients[0],
      await authorize(page, metadata, clients[0]),
    ),
  );
  try {
    await expectOAuthError(
      await refresh(request, metadata, clients[1], pair.refresh_token),
      "invalid_grant",
    );
    const response = await clientPost(
      request,
      metadata,
      clients[1],
      metadata.revocation_endpoint,
      { token: pair.refresh_token, token_type_hint: "refresh_token" },
    );
    expect([200, 400]).toContain(response.status());
    await expectMcpAccess(request, pair.access_token);
    const rotated = await tokens(
      await refresh(request, metadata, clients[0], pair.refresh_token),
    );
    await revoke(request, metadata, clients[0], rotated.refresh_token);
  } finally {
    await revoke(request, metadata, clients[0], pair.refresh_token);
  }
});

test("tampering with the consent ticket shows an error and issues no code", async ({
  page,
  request,
}) => {
  const metadata = await discover(request);
  const transaction = authorization(metadata, clients[0]);
  await showConsent(page, transaction.url);
  await page.locator('input[name="consent"]').evaluate((element) => {
    if (!(element instanceof HTMLInputElement))
      throw new Error("Missing consent ticket");
    element.value = "invalid-ticket";
  });
  await page.getByRole("button", { name: /^allow( access)?$/i }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Start again from your app",
  );
  expect(new URL(page.url()).origin).toBe(new URL(metadata.issuer).origin);
});
