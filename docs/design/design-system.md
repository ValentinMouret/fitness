# Design System

Use this guide for shared visual and interaction rules in Fitness's mobile UI.
It extends Radix UI with project tokens and patterns. For component boundaries
and CSS organisation, see [frontend conventions](../engineering/frontend.md).
Feature wireframes may illustrate these rules but must not redefine them.

## Design Principles

### Light & Minimalist
The design prioritizes clarity and simplicity, reducing cognitive load while maintaining visual hierarchy and functionality.

### Consistent Interactions
All interactive elements follow predictable patterns for expanding content, inline editing, and state feedback.

### Semantic Color Usage
Colors convey meaning through consistent application: tomato for primary actions and active navigation, green for success feedback/toasts, red for destructive actions, and contextual colors for categorization. Completion treatment follows the feature patterns below. New completion feedback must not rely on color alone.

### Smooth Transitions
All animations use consistent timing and easing to create cohesive, polished interactions.

## Foundation

### Theme Configuration
```typescript
// root.tsx
<Theme accentColor="tomato" grayColor="sand" radius="medium">
```

- **Accent Color**: Tomato — primary actions, active navigation and feature-specific completion accents
- **Gray Scale**: Sand — warm, approachable neutral tones
- **Border Radius**: Medium (12px) — clean, modern feel

### Typography

Quiet editorial was selected by Valentin on 5 October 2026. Crimson Pro is reserved for the primary page title; DM Sans provides consistent supporting headings, controls, prose and numbers. Apply the same roles across viewport sizes and completion states.

| Role | Size / line height | Weight | Family |
|---|---|---|---|
| Page title | 1.75rem / 1.25 (28 / 35px) | 500 | Crimson Pro |
| Section or dialog title | 1.25rem / 1.4 (20 / 28px) | 500 | DM Sans |
| Body, item name and numeric value | 1rem / 1.5 (16 / 24px) | 400; item name may use 500 | DM Sans |
| Supporting copy and action | .875rem / 1.5 (14 / 21px) | 400; action 500 | DM Sans |
| Caption, unit and column label | .75rem / 1.5 (12 / 18px) | 400; label may use 500 | DM Sans |

Default tracking is zero. Avoid decorative uppercase. Use tabular numerals for comparable data, timers and statistics. A timer/stat normally uses the section role; greater prominence requires a documented reading need.

Map Radix default, heading and strong families to DM Sans. Apply the serif explicitly to the page-title role, independently of HTML heading level. Keep semantic heading levels; a section does not become h1 to obtain its visual size. Inputs and saved numbers use the same 16px role. Dialog portals inherit the same mappings. Reflow rather than shrinking text on mobile.

Implementation is staged: this decision does not approve unrelated layout or interaction changes. The active workout screens follow their own [live workout rules](#live-workout); everywhere else these roles apply. Delivery scope and evidence for the original rollout are tracked in ENSO-105 and ENSO-110.

### Brand Tokens
Defined in `app/app.css`:
```css
/* Signal C palette */
--brand-background: #faf9f7;       /* Page background (flat, no gradient) */
--brand-surface: #f3f1ed;          /* Card/header backgrounds */
--brand-coral: #e15a46;            /* Accent */
--brand-amber: #f59e0b;
--brand-success: #22c55e;
--brand-text: #1c1917;
--brand-text-secondary: #79756d;

/* Flat neutral shadows */
--shadow-warm-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-warm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-warm-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-warm-hover: 0 4px 12px rgba(0, 0, 0, 0.10);
```

## Design Tokens

### Motion System
```css
/* Standard easing for all transitions */
cubic-bezier(0.4, 0, 0.2, 1)

/* Durations */
fast:   0.15s  /* Hover states, micro-interactions */
normal: 0.25s  /* Standard animations */
slow:   0.35s  /* Complex state changes, page transitions */
```

**Stagger animations**: For lists of cards/items, use `fadeSlideUp` with 50ms delay increments per child (defined in `app/app.css`).

### Runtime spacing and heading tokens

Values defined in [app/app.css](../../app/app.css), assuming a 16px root font size. These project variables are literal rem values, not aliases for Radix spacing variables. Radix's own scale remains available for component spacing.

| Token | Default | At widths ≤640px |
| --- | --- | --- |
| `--space-page` | 2rem (32px) | 1rem (16px) |
| `--space-section` | 1.5rem (24px) | 1rem (16px) |
| `--space-card` | 1rem (16px) | 0.75rem (12px) |

Typography roles above replace the former unused responsive heading tokens. Existing feature size ladders migrate in reviewed slices.

### Semantic Colors
| Role | Color | Usage |
|------|-------|-------|
| Primary | `tomato` | Buttons, active nav, CTAs; feature-specific completion accents |
| Success | `green` | Toasts, confirmations; completed sets and exercises in a live workout |
| Warning | `amber` | Pending/editable states; warm-up sets |
| In-progress | `orange` | Active workout, warmup |
| Error | `red` | Destructive actions |
| Info | `blue` | Informational content |

## Component Patterns

### Card Containment
Choose containment by the interaction. Summary cards can use a warm surface; related data rows can share one container or use dividers. Do not wrap every content block in its own card. The live workout is the exception: each set is a card so one-handed logging has large, separate targets.

Example warm surface:

```css
.my-card {
  padding: var(--space-4);
  background: var(--brand-surface);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-3);
  box-shadow: var(--shadow-warm-sm);
}
```

### Row State Indicators
Editable data-table rows use a **left border accent** as the default state indicator. The live workout's set cards use the fills described under [live workout](#live-workout) instead.

| State | CSS |
|-------|-----|
| Completed | `border-left: 3px solid var(--tomato-8)` |
| Pending/editable | `border-left: 3px solid var(--amber-8)` |
| Default | No border |

### Inline Inputs (Underline Style)
Inputs inside data tables use underline style, not boxed:

```css
.my-input.rt-TextFieldRoot {
  --text-field-border-width: 0px;
  background: transparent;
  box-shadow: inset 0 -1px 0 var(--gray-7) !important;
  border-radius: 0;
}

.my-input.rt-TextFieldRoot:focus-within {
  box-shadow: inset 0 -2px 0 var(--tomato-8) !important;
}
```

### Progress Indicators
Thin progress bars for tracking completion:

```css
/* Track */
height: 5px;
background: var(--gray-4);
border-radius: 3px;

/* Fill */
background: var(--tomato-9);
transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

### Summary Cards
Stats grids use display font for values:

```css
.stat-value {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--brand-text);
}

.stat-label {
  font-size: var(--font-size-1);
  color: var(--brand-text-secondary);
}
```

### Sticky Headers
Page-level headers use warm surface with shadow:

```css
.my-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--brand-surface);
  border-bottom: 1px solid var(--gray-4);
  box-shadow: var(--shadow-warm-sm);
}
```

### Status Feedback
- Existing completion follows feature patterns: live workout sets turn green with a filled tick, and finished exercises show a green check. Habits retain their existing per-habit colors and completion labels. New completion feedback needs a readable label or accessible state as well as color.
- Loading states during async operations
- Confirmation dialogs for destructive actions
- Badge system for categorization

## Usage Guidelines

### Colors
- Use semantic color names (tomato, amber) rather than hex values
- `--brand-*` tokens for backgrounds, text, shadows
- Radix color scales (e.g. `var(--tomato-8)`) for component accents

### Shadows
- Always use `--shadow-warm-*` instead of generic `box-shadow`
- The warm-surface example uses `--shadow-warm-sm`; current global `.rt-Card` uses `--shadow-warm` and hover uses `--shadow-warm-hover`. Preserve those existing treatments until a visual consolidation slice is reviewed.

### Animations
- `normal` (0.25s) for most interactions
- `fast` (0.15s) for hover states
- `slow` (0.35s) for page transitions
- Stagger children at 50ms increments using `animation-delay`

### Mobile
- Touch targets: minimum 44px on mobile (`min-height: 44px; min-width: 44px`)
- Inputs: `font-size: 16px` to prevent iOS auto-zoom
- Bottom padding: account for tab bar + safe area inset

## Existing component roles

| Foundation | Responsibility |
| --- | --- |
| `AppLayout` | Shared navigation, route-header composition and safe-area layout |
| `PageHeader` | Page identity, optional back link and primary/secondary actions; existing CSS stacks actions on mobile |
| `SectionHeader` | Section title and optional trailing action |
| Radix controls | Primary primitives for buttons, dialogs, inputs and tab panels |
| `NumberInput`, `EmptyState`, `Skeleton`, `Celebration` | Existing reusable controls and feedback; inspect before adding equivalents |
| Feature presentation components | Domain-specific rendering such as meal cards, workout rows and dashboard stats |

Shared components receive UI-shaped props and do not import feature domain code. Keep completion rules, meal assignments and persistence semantics in their feature layers. See [frontend conventions](../engineering/frontend.md).

Dashboard retains direct weight entry and its trend; the workout patterns below are feature-specific, not a mandate to give every page workout chrome.

## Live workout

**Accepted: replaces Workout V3, selected by Valentin on 11 October 2026.** The
active workout overview and exercise screens follow the "Active Workout" design
archive, with these rules:

- **Type:** the workout and exercise names, stat values and set numbers use
  Crimson Pro; small section labels use 11px uppercase DM Sans with 0.08em
  tracking. Other text keeps the Quiet editorial roles.
- **Set cards:** each set is a 44px-high card: number, reps, load, then delete
  or RIR, then the tick. The next set has a `--tomato-7` border and
  `--tomato-3` ring. A planned value is a dashed cell with a muted value. A
  completed set uses a `--green-2` fill, `--green-5` border and a solid green
  tick. A warm-up shows an amber "W" (`--amber-3` / `--amber-11`).
- **Rest:** a floating dark bar above the tab bar or exercise navigation, with
  ±15s, Skip and presets on expansion; it turns green when rest is over.
- **Sheets:** choices and confirmations open as bottom sheets
  (`app/components/BottomSheet`, `ConfirmSheet`) with a drag handle and a
  display-font title: RIR, add or replace exercise, history, finish and remove.
- **Chrome:** the exercise screen hides the tab bar and has its own Back link
  and Previous/Next bar.

## Nutrition navigation and meal filters

**Accepted: Action workspace, selected by Valentin on 6 October 2026.** Nutrition
Today uses date controls, Your day with grouped nutrition totals, meal-level
Log/Edit and action menus, quiet tools, and a full-width soft Meal templates link
at the bottom. Do not add a Today/Templates tab strip or a page-level Log meal
button or a page-level overflow menu. Keep Meal Builder, Calculate targets and
Estimate meal in the bottom tools area. Templates has an immediate header Back link, a Meal time select and
Create template toolbar, its template list, and a bottom Back to today link.
Retain the selected date across those links and template filter, create, edit,
Save and Cancel operations.

Use Quiet editorial typography and 44px touch targets. Template rows wrap long
names and assignments without truncation. All meals shows every template once;
other choices show templates explicitly assigned to that meal. Filtering never
changes assignments or the meal context of a log. Removing an assignment may
remove that template from the selected results. Create/edit retains explicit
multi-selection without automatic assignment from the active filter.

The logging picker remains scoped to its chosen meal and has no All option.
Its eligibility follows the same assignments as management filters. Preserve
real editor, sharing, estimation, target calculation and persistence behavior.

Native Safari/PWA title blur remains unresolved. This navigation decision is
not evidence of a physical-device blur fix. Scope and selected-design evidence
are recorded in [ENSO-107](https://linear.app/valentin-mouret/issue/ENSO-107).
