import { createRequestHandler, type ServerBuild } from "react-router";
import { describe, expect, it } from "vitest";
import config, { allowedActionOrigins } from "../react-router.config";

// Minimal build exercising React Router's real single-fetch action CSRF check.
function buildWith(origins: readonly string[] | undefined): ServerBuild {
  const build: ServerBuild = {
    entry: {
      module: {
        default: () => new Response("document"),
      },
    },
    routes: {
      root: {
        id: "root",
        path: "",
        module: {
          action: () => ({ ok: true }),
          default: () => null,
        },
      },
    },
    assets: {
      entry: { module: "", imports: [] },
      routes: {},
      url: "",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "",
    basename: "/",
    future: {
      v8_middleware: false,
      v8_passThroughRequests: false,
      v8_trailingSlashAwareDataRequests: false,
    },
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
    allowedActionOrigins: origins ? [...origins] : false,
  };
  return build;
}

// Cloudflare terminates TLS: the app receives http:// for the public host.
function tunnelledPost(origin: string): Request {
  return new Request("http://fitness.valentinmouret.io/_root.data", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });
}

describe("action origins behind the TLS-terminating tunnel", () => {
  it("allows exactly the public host", () => {
    expect(config.allowedActionOrigins).toEqual(["fitness.valentinmouret.io"]);
    expect(allowedActionOrigins.some((o) => o.includes("*"))).toBe(false);
  });

  it("rejects the browser's https origin without the allowance", async () => {
    const handler = createRequestHandler(buildWith(undefined), "production");
    const response = await handler(
      tunnelledPost("https://fitness.valentinmouret.io"),
    );
    expect(response.status).toBe(400);
  });

  it("accepts the browser's https origin with the configured allowance", async () => {
    const handler = createRequestHandler(
      buildWith(allowedActionOrigins),
      "production",
    );
    const response = await handler(
      tunnelledPost("https://fitness.valentinmouret.io"),
    );
    expect(response.status).toBe(200);
  });

  it("still rejects foreign origins", async () => {
    const handler = createRequestHandler(
      buildWith(allowedActionOrigins),
      "production",
    );
    const response = await handler(tunnelledPost("https://evil.example"));
    expect(response.status).toBe(400);
  });
});
