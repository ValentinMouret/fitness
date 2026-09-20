# Frontend conventions

Use this guide when building components or adapting domain data for the UI.
Fitness targets mobile screens; desktop-specific layouts are outside its scope.
For loaders, forms, URL state, and route files, use the
[React Router guide](react-router.md). For visual rules, use the
[design system](../design/design-system.md).

## Choose the component boundary

| Category | Location | Responsibility |
| --- | --- | --- |
| Shared | `app/components/` | Generic UI with plain, UI-shaped props and no feature dependencies |
| Feature | `app/modules/<feature>/presentation/components/` | Feature-specific rendering and interactions |
| Route | `app/routes/` | Request orchestration, navigation, and composition of feature components |

Shared components must not import module domain, application, or presentation
code. App-wide cards and form controls belong here only if they remain generic.
Feature components stay within their feature boundary. Keep business rules in the
domain and application layers rather than hiding them in components.

Keep components pure and focused, with one component per file. Simple route
orchestration components may be colocated with their route; reusable feature UI
belongs in the module.

## Adapt data before rendering

Loaders return JSON-serializable view models rather than domain entities or
non-serializable values. View-model mappers turn domain data into the labels,
values, and states needed by the UI. Name them
`<feature-name>-<component>.view-model.ts`.

```ts
interface WorkoutCardProps {
  readonly viewModel: WorkoutCardViewModel;
}
```

Keep database access behind loaders, actions, or server-only modules, never inside
React components. See [architecture](architecture.md) for dependency direction.

## Keep styles outside JSX

Use Radix UI as the primary component library. Reuse existing primitives and
centralised theme tokens; Tailwind utilities are available where appropriate.
Put component-specific CSS next to its component and import it from that file.

```text
WorkoutCard/
├── WorkoutCard.tsx
├── WorkoutCard.css
└── index.ts
```

Do not use static `style` props, embedded `<style>` tags, or CSS-in-JS. Use CSS
classes for conditional states. An inline `style` is acceptable only for a
computed value that CSS cannot express, such as a progress width or drag transform.

```tsx
<div className={isCompleted ? "set-row set-row--completed" : "set-row"} />
<div className="progress__fill" style={{ width: `${percent}%` }} />
```

Use the [design system](../design/design-system.md) for typography, semantic
colours, spacing, cards, inputs, motion, and touch targets. Do not establish
separate tokens in feature specifications.

## Make interactions accessible

Use semantic HTML before adding ARIA. Links navigate; buttons act. Give every
form control a visible or programmatic label and every button an explicit `type`.
Keep heading levels ordered and the complete flow keyboard-operable.

Accessibility linting is a baseline, not a substitute for testing the interaction.
Test pure view-model mappers directly and changed user workflows with Playwright;
see [testing](testing.md).
