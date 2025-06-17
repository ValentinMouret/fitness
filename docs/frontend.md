# Frontend
## React Router patterns
In React Router v7, data loading is done with `loaderData` or `clientLoaderData`:
```tsx
import { type Route } from "./+types/index" // if fileis index.ts

export async function loader(){
  return ...
}

export default function MyPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="my-page">
      <h1>{loaderData.title}</h1>
      <p>{loaderData.description}</p>
    </div>
  );
}
```

Actions work in a similar way.

Submitting forms create a navigation. Sometimes, it’s desireable. Sometimes, it’s better for UX to use `useFetcher` to submit forms without navigation and have an optimistic UI.

## Components
UI components should be pure and have as little logic as possible.
There should be one component per file.

If the component is general, reused accross the app, it should appear in `app/components`.
If the component is local to a page, it should be next to said page, e.g. `app/routes/dashboard/Chart.tsx`

The style for the component should leave next to it: `app/routes/dashboard/Chart.css`.
DON'T PUT STYLE INSIDE THE COMPONENT (like, `style=` props or a `<style>` element).
Check the global styles in `app/styles/app.css`.


Example component:
```tsx
interface ChartProps<T> {
  readonly title: string;
  readonly onUpdate: (data: T) => void;
}

export default function Chart<T>({ title, onUpdate }: ChartProps<T>) {
  return (
    <div className="chart">
      <h2>{title}</h2>
      <div className="chart-content">
        <div className="chart-item">Item 1</div>
        <div className="chart-item">Item 2</div>
        <div className="chart-item">Item 3</div>
      </div>
    </div>
  );
}
```
