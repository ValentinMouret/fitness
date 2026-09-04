# React-router v7
## Routes and types
* routes are defined in `routes.ts`
  * once they are defined, types for the route will be generated automatically and available with the `Route` type (c.f. below)
  * a route `workouts/:id.tsx` will have its types available in `./+types/:id`
  * an action gets its parameters with: `Route.ActionArgs`
  * a loader gets its parameters with: `Route.LoaderArgs`
  * the component gets its parameters with: `Route.ComponentProps`
* for a route to accept a parameter, it should be e.g. `workouts/:id`, not `workouts/$id`

Keep the route tree explicit in `app/routes.ts` and keep route files aligned
with URL segments. Each screen should have an addressable URL that can be
reloaded, bookmarked, and shared. Run `bun run tc` after adding, moving, or
renaming a route so generated types match the tree. Never edit generated types.

Receive data through `Route.ComponentProps` and its `loaderData` property.
Validate route parameters and URL search parameters with Zod in the loader.
Return JSON-serializable view models, not domain entities or non-serializable
values.

## Forms
Forms are idiomatic in React-Router. If there needs to be a submission without navigation, use `fetcher.Form` (from `useFetcher`).

Prefer simple routes and handle different actions with an `intent` input in the form handled by a switch on the action.

Use `<Form method="post">` for navigation-causing writes, redirect after a
successful write, and use `useFetcher` only when a mutation must not navigate.
Give every form control a `name`; input names are the action contract. Render
expected validation failures as safe action data with an appropriate 4xx status.

### Form Data Handling
- Use `formData.get("field")?.toString()` instead of `as string` for safer type handling
- Always validate form data server-side and handle undefined/null cases
- Use proper number validation with `Number.isNaN()` instead of global `isNaN()`

## Actions and Responses
- Actions return plain objects `{ success: true }` or `{ error: "message" }`
- No need to wrap responses with `data()` - just return objects directly
- Use `redirect("/path")` for navigation after successful operations

## Navigation and UI Patterns
- Always add "Create" buttons or navigation elements to index pages
- Use `Form` components for state-changing operations (POST requests)
- Use `Link` components for navigation (GET requests)
- Index pages should provide clear entry points to create new resources

## URL Search Parameters
- Use `useSearchParams()` from "react-router" to read and write URL query string
- Returns a tuple: `[searchParams, setSearchParams]`
- `searchParams` is a URLSearchParams object with methods like `.get("key")`
- `setSearchParams()` accepts an object to update parameters: `setSearchParams({ page: "2" })`
- The searchParams object has a stable reference, safe for useEffect dependencies
- Example:
  ```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get("page") || "1";

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
  };
  ```

Keep durable view state in the URL: selected records, filters, active tabs, and
pagination. Use React state for ephemeral presentation state only. Avoid data
fetching in `useEffect` when a loader can own the data.

## Error Handling
- Preserve `neverthrow` errors through the domain and application layers; map
  them at infrastructure and route boundaries.
- Return safe, user-friendly expected errors from actions with proper HTTP
  status codes.
- Add a route `ErrorBoundary` when surrounding UI should survive an unexpected
  failure. Do not display internal error messages to users.

## Server boundary

Keep database access in loaders, actions, and `*.server.ts` modules. Never
query Drizzle from a React component. Use `env` from `app/env.server.ts` and
the Pino logger from `app/logger.server.ts` for server-side code.
