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

The style for the component should live next to it: `app/routes/dashboard/Chart.css`.

## Styling Rules (STRICT)
**NEVER** put styles inside components:
- ❌ NO `style={}` props
- ❌ NO `<style>` elements/tags
- ❌ NO CSS-in-JS
- ❌ NO inline styles

**ALWAYS** use external CSS files:
- ✅ Create `.css` file next to component
- ✅ Import CSS file: `import "./Chart.css"`
- ✅ Use `className` with semantic names
- ✅ Leverage global styles in `app/app.css`

## Available Global Classes
Use these classes from `app/app.css`:
- **Buttons**: `.button`, `.button-primary`, `.button-secondary`, `.button-link`
- **Forms**: `.form-group`, `.form-label`, `.form-input`, `.form-textarea`
- **Layout**: `.page`, `.page-header`, `.card`, `.card-header`, `.grid`
- **Checkboxes**: `.checkbox-wrapper`, `.checkbox-button`, `.checkbox-label`
- **Utilities**: `.text-muted`, `.text-small`, `.mb-1`, `.mb-2`, `.gap-1`
- **States**: `.checked`, `.error-message`, `.empty-state`


## Component Structure Example
`app/routes/dashboard/Chart.tsx`:
```tsx
import "./Chart.css";

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

`app/routes/dashboard/Chart.css`:
```css
.chart {
  /* Component-specific styles */
}

.chart-content {
  /* Use global .grid if applicable, or define custom */
}

.chart-item {
  /* Item styles */
}
```

## Dynamic Styling
For conditional styles, use dynamic class names:
```tsx
// ✅ Good
<button className={`checkbox-button ${isCompleted ? 'checked' : ''}`}>

// ❌ Bad
<button style={{ background: isCompleted ? '#green' : 'white' }}>
```
