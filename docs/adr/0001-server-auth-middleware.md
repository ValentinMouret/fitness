# ADR 0001: Enforce browser authentication with server route middleware

Status: Accepted

Date: 2026-09-14

## Context

Fitness has one owner and uses a signed session cookie. Protected page loaders and actions previously called `requireAuth(request)` individually. That works, but every new handler must remember the guard, and unrelated route modules become coupled to authentication.

A parent loader cannot enforce authentication for its descendants: React Router runs matched loaders in parallel. Authentication must finish before any protected loader or action starts, including direct resource requests and fetcher submissions.

## Decision

Enable `future.v8_middleware` in `react-router.config.ts`. React Router 7.13 supports server route middleware; no dependency upgrade or custom server is required.

Export the authentication middleware from `app/layouts/ProtectedLayout.tsx`:

```ts
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request }, next) => {
    await requireAuth(request);
    return next();
  },
];

export function loader() {
  return null;
}
```

Middleware runs before descendant loaders and actions. `requireAuth` remains in the auth module's infrastructure layer and owns session validation, login redirects, and same-origin checks for unsafe methods. A failed check throws before `next()` can reach application work.

Keep the small layout loader. Server middleware only runs when a request reaches the server; the loader ensures client navigation involving this layout also makes a data request, including navigation to pages without their own loader. Client middleware and UI redirects are not security boundaries.

## Route placement

- Register every session-protected page and resource route beneath `ProtectedLayout` in `app/routes.ts`. This includes `/api/exercises/history` and `/api/nutrition/estimate-meal`. A pathless layout does not change their URLs.
- Child loaders and actions contain their application work without repeated `requireAuth` calls. A route that does not otherwise need a loader does not add one just for authentication.
- Keep login, logout, health checks, and the public read-only share endpoint outside this layout. Login and logout retain their own same-origin checks.
- Keep OAuth and MCP outside it. Authorization validates the client and callback before checking the browser session in the consent service. Token exchange and revocation authenticate the OAuth client; MCP authenticates its bearer token on each request. A browser session does not replace those protocol checks.

## Consequences

New descendants are protected automatically. Moving a route outside this layout changes its security boundary and requires review and a test. Routes needing a different authentication scheme must enforce that scheme explicitly.

The protected layout no longer returns unused user data. If a child later needs the authenticated user, publish it through React Router's typed request context from middleware rather than parsing the session again. A future custom server must provide a `RouterContextProvider` if it implements `getLoadContext`.

## Verification

The auth acceptance suite exercises missing and forged sessions through document requests, individual loader requests, direct resource requests, and actions. Mutation tests verify rejection before writes. Browser tests cover login persistence and client navigation to a loaderless page after the session is removed. OAuth tests ensure the separate protocol endpoints remain reachable and enforce their own checks.

Run against the existing test server with the credentials and fixtures described in [authentication setup](../operations/authentication.md):

```sh
bun run test:e2e:auth browser-session protected-routes mutation-boundary oauth.spec.ts
```

## References

- [React Router middleware](https://reactrouter.com/how-to/middleware)
- [React Router v7 middleware flag](https://reactrouter.com/upgrading/v7#futurev8_middleware)
