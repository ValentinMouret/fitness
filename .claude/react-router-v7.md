# React-router v7
## Routes and types
* routes are defined in `routes.ts`
  * once they are defined, types for the route will be generated automatically and available with the `Route` type (c.f. below)
  * a route `workouts/:id.tsx` will have its types available in `./+types/:id`
  * an action gets its parameters with: `Route.ActionArgs`
  * a loader gets its parameters with: `Route.LoaderArgs`
  * the component gets its parameters with: `Route.ComponentProps`
* for a route to accept a parameter, it should be e.g. `workouts/:id`, not `workouts/$id`

## Forms
Forms are idiomatic in React-Router. If there needs to be a submission without navigation, use `fetcher.Form` (from `useFetcher`).

Prefer simple routes and handle different actions with an `intent` input in the form handled by a switch on the action.

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

## Error Handling
- Handle loader/action errors gracefully with try/catch
- Return user-friendly error messages from actions
- Use proper HTTP status codes for different error types
