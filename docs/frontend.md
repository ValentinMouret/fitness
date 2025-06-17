# Frontend
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
