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

## Component Architecture

### Component Categories
1. **Shared Components** (`app/components/`): Generic, reusable UI components with zero domain knowledge
   - Accept generic props only
   - No imports from module domain/application layers
   - Examples: `Button`, `Modal`, `Chart`, form primitives

2. **Feature Components** (`modules/{feature}/presentation/components/`): Domain-specific UI components
   - Can import from same module's domain/application layers
   - Use view models for data transformation
   - Encapsulated within feature boundary
   - Examples: `WorkoutExerciseCard`, `HabitCheckbox`, `NutritionCalculator`

3. **Route Components** (`app/routes/`): Orchestration and navigation logic
   - Import feature components from modules
   - Handle React Router concerns (loaders, actions, navigation)
   - Minimal UI logic - delegate to feature components
   - Focus on data fetching and form submission

### Component Organization Rules
- UI components should be pure and have as little logic as possible
- There should be one component per file
- Feature-specific components belong in `modules/{feature}/presentation/components/`
- Generic components belong in `app/components/`
- Route-specific components can stay next to routes if they're simple orchestration only

### View Model Pattern
Feature components should accept view models instead of domain entities:

```tsx
// ❌ Bad: Direct domain entity usage
interface WorkoutCardProps {
  readonly workout: WorkoutSession; // Domain entity
}

// ✅ Good: View model usage
interface WorkoutCardProps {
  readonly viewModel: WorkoutCardViewModel; // UI-friendly data
}
```

View model files should be named: `{feature-name}-{component}.view-model.ts`

### Module Structure
```
modules/{feature}/presentation/
├── components/
│   ├── {FeatureName}Card/
│   │   ├── index.tsx
│   │   ├── {FeatureName}Card.tsx
│   │   └── {FeatureName}Card.css
│   └── index.ts (barrel export)
├── view-models/
│   ├── {feature-name}-card.view-model.ts
│   └── index.ts
└── hooks/
    ├── use{FeatureName}.ts
    └── index.ts
```

The style for the component should live next to it: `{FeatureName}Card.css`.

## Styling Rules (STRICT)
**NEVER** put styles inside components:
- ❌ NO `style={}` props for static styling
- ❌ NO `<style>` elements/tags
- ❌ NO CSS-in-JS
- ❌ NO inline styles

**Exception**: `style={}` is acceptable for **data-driven dynamic values** that cannot be expressed in CSS (e.g. progress bar widths, drag transforms). This matches existing patterns like `RestTimer` and dnd-kit wrappers.

**ALWAYS** use external CSS files:
- ✅ Create `.css` file next to component
- ✅ Import CSS file: `import "./Chart.css"`
- ✅ Use `className` with semantic names
- ✅ Reference design tokens from `docs/design-system.md` for consistent look


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
// ✅ State-driven classes
<div className={`set-row ${set.isCompleted ? "set-row--completed" : canEdit ? "set-row--pending" : ""}`}>

// ✅ Data-driven dynamic value (acceptable inline style)
<div className="progress__fill" style={{ width: `${percent}%` }} />

// ❌ Static styling via inline style
<button style={{ background: 'green', borderRadius: 8 }}>
```

## Design Reference
See `docs/design-system.md` for:
- Brand tokens (`--brand-surface`, `--shadow-warm-*`)
- Card containment pattern
- Row state indicators (left border accents)
- Inline input styling (underline, not boxed)
- Progress bars
- Summary card grids
- Sticky header pattern
