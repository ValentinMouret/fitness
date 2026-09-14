import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import type { RouteConfigEntry } from "@react-router/dev/routes";
import {
  UNSAFE_decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol,
} from "react-router";
import { z } from "zod";
import routes from "../../../app/routes";
import {
  credentials,
  expectUnauthenticated,
  sessionCookieName,
} from "../support/auth";

const publicRoutes = new Set([
  "routes/.well-known/oauth-authorization-server.ts",
  "routes/.well-known/oauth-protected-resource.ts",
  "routes/oauth/authorize.tsx",
  "routes/oauth/token.ts",
  "routes/oauth/revoke.ts",
  "routes/mcp.ts",
  "routes/login.tsx",
  "routes/logout.tsx",
  "routes/healthz.ts",
  "routes/share/meal.tsx",
]);
const missingId = "00000000-0000-4000-8000-000000000000";

function collectRoutes(
  entries: readonly RouteConfigEntry[],
  parent = "",
): readonly {
  readonly path: string;
  readonly file: string;
  readonly loader: boolean;
  readonly action: boolean;
  readonly resource: boolean;
}[] {
  return entries.flatMap((entry) => {
    const path = `${parent}/${entry.path ?? ""}`.replace(/\/+/g, "/");
    if (entry.children) return collectRoutes(entry.children, path);
    if (publicRoutes.has(entry.file)) return [];
    const source = readFileSync(resolve("app", entry.file), "utf8");
    return [
      {
        path: path.replace(/:[\w-]+/g, missingId),
        file: entry.file,
        loader: /export\s+(?:(?:async\s+)?function|const)\s+loader\b/.test(
          source,
        ),
        action: /export\s+(?:(?:async\s+)?function|const)\s+action\b/.test(
          source,
        ),
        resource: !/export\s+default\b/.test(source),
      },
    ];
  });
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

for (const authentication of ["missing", "forged"] as const) {
  test.describe(`${authentication} authentication`, () => {
    test.use({
      extraHTTPHeaders:
        authentication === "forged"
          ? {
              Cookie: `${sessionCookieName}=${encodeURIComponent(JSON.stringify({ username: credentials.username }))}`,
            }
          : {},
    });

    for (const route of collectRoutes(routes)) {
      if (!route.resource) {
        test(`document GET ${route.path}`, async ({ request }) => {
          expectUnauthenticated(
            await request.get(route.path, { maxRedirects: 0 }),
          );
        });
      }

      if (route.loader) {
        test(`direct loader GET ${route.path}`, async ({ request }) => {
          const url = route.resource
            ? route.path
            : `${route.path === "/" ? "/_root" : route.path}.data`;
          const response = await request.get(url, {
            params: route.resource
              ? { exerciseId: missingId }
              : { _routes: route.file.replace(/\.[^.]+$/, "") },
            maxRedirects: 0,
          });
          if (route.resource || response.status() !== 202) {
            expectUnauthenticated(response);
            return;
          }
          // Decode the router's redirect response, not a substring that could hide leaked loader data.
          const body = new Response(await response.text()).body;
          if (!body) throw new Error("Missing router response body");
          const decoded = await UNSAFE_decodeViaTurboStream(body, globalThis);
          const result = z
            .custom<Record<symbol, unknown>>(
              (value) =>
                typeof value === "object" &&
                value !== null &&
                UNSAFE_SingleFetchRedirectSymbol in value,
            )
            .parse(decoded.value);
          expect(Object.keys(result)).toHaveLength(0);
          const redirect = z
            .object({ redirect: z.string(), status: z.number() })
            .parse(result[UNSAFE_SingleFetchRedirectSymbol]);
          expect([302, 303]).toContain(redirect.status);
          expect(new URL(redirect.redirect, response.url()).pathname).toBe(
            "/login",
          );
        });
      }

      if (route.action) {
        test(`direct action POST ${route.path} authenticates before parsing input`, async ({
          request,
        }) => {
          expectUnauthenticated(
            await request.post(route.path, {
              form: { intent: "auth-e2e-invalid-intent" },
              maxRedirects: 0,
            }),
          );
        });
      }
    }
  });
}
