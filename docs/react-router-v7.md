# React Router v7

Use this guide when adding or changing Fitness routes. Read the
[README](../README.md) first for application boundaries and verification commands.
This guide covers framework-mode route APIs and project conventions, not a
migration from Remix or a general React tutorial. See [frontend.md](frontend.md)
for component architecture and styling.

Fitness uses React Router v7 in framework mode with server-side rendering.
`react-router.config.ts` enables `v8_middleware`; authentication follows
[ADR 0001](adr/0001-server-auth-middleware.md).

## Define routes and generate types

Register routes explicitly in `app/routes.ts`, using helpers from
`@react-router/dev/routes`. Dynamic URL segments use `:id`, not `$id`.
Route file names do not define URLs; the route configuration does.

Keep files aligned with URL segments as a project convention. For example:

```ts
route("workouts/:id", "routes/workouts/:id/index.tsx")
```

In that module, import `Route` from `"./+types/index"`. The generated type
module follows the route file's basename, not its URL parameter name.

- Type loaders with `Route.LoaderArgs`.
- Type actions with `Route.ActionArgs`.
- Receive `loaderData` and `actionData` through `Route.ComponentProps`.
- Type error boundaries with `Route.ErrorBoundaryProps`.

Run `bun run tc` after adding, moving, or renaming routes. This runs React
Router type generation and TypeScript. Never edit generated route types.
Nested route components render their child route through `<Outlet />`.

## Load data at the route boundary

Use a server `loader` for data needed by a URL, including subsequent client
navigations. Validate route parameters and search parameters with Zod before
calling application services. Route modules orchestrate; business rules belong
in domain and application modules.

Return JSON-serializable view models as a project convention, rather than
passing domain entities to components. React Router supports additional
serializable types, but that does not change this application's UI boundary.
Plain return objects are sufficient when no custom status or headers are needed.

Prefer loaders over fetching route data in `useEffect`. Use `clientLoader`
only for a browser-specific data requirement; it is not needed for ordinary
client navigation. Its result is also exposed as `loaderData`, not a separate
`clientLoaderData` component prop. By default, a `clientLoader` paired with a
server loader does not run during initial hydration. If hydration-time loading
is necessary, explicitly configure `clientLoader.hydrate` and consider a
`HydrateFallback` while client data loads.

## Keep durable view state in the URL

Give each screen an addressable URL. Store selected records, filters, tabs,
and pagination in path or search parameters. Reserve React state for ephemeral
presentation state.

Use `<Link>` for navigation and `<Form method="get">` for search or filters.
Use `useSearchParams()` when an interaction needs a programmatic query update.
Setting search parameters causes navigation and replaces the query unless you
preserve existing keys:

```tsx
setSearchParams((previous) => {
  const next = new URLSearchParams(previous);
  next.set("page", "2");
  return next;
});
```

Do not mutate the stable `searchParams` object without calling its setter:
that would change the object without updating the URL.

## Submit writes through actions

Use `<Form method="post">` for writes that navigate, and return `redirect()`
after success. Use `useFetcher` and `<fetcher.Form method="post">` when the
write must leave the user on the current screen. Fetchers can also load data
without navigation, but a route loader remains the default for screen data.

Give submitted controls a `name` and buttons an explicit `type`. If a route
supports multiple operations, submit an `intent` field and validate it as a
Zod enum or discriminated union. Reject unknown intents.

Validate raw form values server-side. `formData.get()` returns a string,
`File`, or `null`; `.toString()` is not validation and can hide an unexpected
file upload. For text fields, pass the raw value to a string schema:

```ts
import { data } from "react-router";
import { z } from "zod";

const nameSchema = z.string().trim().min(1, "Enter a name.");
```

Inside the action, validate before calling the application layer:

```ts
const formData = await request.formData();
const result = nameSchema.safeParse(formData.get("name"));
if (!result.success) {
  return data({ error: "Enter a name." }, { status: 400 });
}
```

Use `formData.getAll()` for repeated fields. For numeric inputs, validate empty
or missing values before coercion: JavaScript number conversion turns `""`
and `null` into zero. Enforce the domain's range and integer constraints too.

## Return responses and show pending state

- Return plain objects for data with the default success status.
- Use `data(payload, { status, headers })` from `react-router` when a response
  needs a custom status or headers. It is not obsolete.
- Return expected validation failures as safe action data with an appropriate
  4xx status. Render them from `actionData` or `fetcher.data`.
- Use `useNavigation()` for navigation pending state and `fetcher.state` for
  a fetcher's pending state. Prevent duplicate submissions where harmful.

Successful action submissions normally revalidate loader data automatically.
Do not add manual reloads by default. Failed actions returning 4xx/5xx responses
do not revalidate loaders by default; do not rely on those responses to refresh
changed data.

## Handle failures and preserve server boundaries

Preserve `neverthrow` errors through domain and application layers. Translate
them to HTTP responses or safe UI data at infrastructure and route boundaries.
Return expected form errors so the user can correct the form. Throw a response
for a route-level failure such as a missing resource.

Errors bubble to the nearest route `ErrorBoundary`. Add boundaries where a
failed child route should leave the surrounding layout usable. Use
`isRouteErrorResponse()` to distinguish thrown responses from unexpected
exceptions. Do not expose internal exception messages to users.

Loaders and actions run on the server; `clientLoader`, `clientAction`, and
components must not import server-only dependencies. Put shared server-only
logic and database access behind `*.server.ts` modules. Never query Drizzle
from a React component. Use `env` from `app/env.server.ts` and the Pino logger
from `app/logger.server.ts`.

## Framework references

These links describe React Router v7 APIs; project conventions above may be
stricter than the framework requires.

- [Route configuration](https://reactrouter.com/start/framework/routing)
- [Route modules](https://reactrouter.com/start/framework/route-module)
- [Data loading](https://reactrouter.com/start/framework/data-loading)
- [Actions](https://reactrouter.com/start/framework/actions)
- [Pending UI](https://reactrouter.com/start/framework/pending-ui)
- [Error boundaries](https://reactrouter.com/how-to/error-boundary)
