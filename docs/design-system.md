# Design System

The Fitness app design system provides a cohesive foundation for building consistent, accessible, and maintainable user interfaces. Built on top of Radix UI, it extends the base component library with fitness-specific patterns and design tokens.

## Design Principles

### Light & Minimalist
The design prioritizes clarity and simplicity, reducing cognitive load while maintaining visual hierarchy and functionality.

### Consistent Interactions
All interactive elements follow predictable patterns for expanding content, inline editing, and state feedback.

### Semantic Color Usage
Colors convey meaning through consistent application: tomato for primary actions and completion states, green for success feedback/toasts, red for destructive actions, and contextual colors for categorization.

### Smooth Transitions
All animations use consistent timing and easing to create cohesive, polished interactions.

## Foundation

### Theme Configuration
```typescript
// root.tsx
<Theme accentColor="tomato" grayColor="sand" radius="medium">
```

- **Accent Color**: Tomato — primary actions, completion states, active navigation
- **Gray Scale**: Sand — warm, approachable neutral tones
- **Border Radius**: Medium (12px) — clean, modern feel

### Typography
- **Display**: `Crimson Pro` (serif) — headings, stat values, display numbers
- **Body**: `DM Sans` (sans-serif) — all body text, labels, inputs
- **Scale**: Radix UI type scale (1-9)

```css
--font-display: "Crimson Pro", Georgia, serif;
--font-body: "DM Sans", system-ui, sans-serif;
```

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

### Spacing Extensions
```css
--space-card: var(--space-4);     /* 16px — internal card padding */
--space-section: var(--space-6);  /* 32px — between major sections */
--space-page: var(--space-8);     /* 64px — page-level spacing */
```

### Semantic Colors
| Role | Color | Usage |
|------|-------|-------|
| Primary | `tomato` | Buttons, active nav, CTAs, completed states |
| Success | `green` | Toasts, confirmations |
| Warning | `amber` | Pending/editable states |
| In-progress | `orange` | Active workout, warmup |
| Error | `red` | Destructive actions |
| Info | `blue` | Informational content |
```

## Component Patterns

### Card Containment
All content blocks (exercise cards, summary cards, etc.) use warm card treatment:

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
Table rows use a **left border accent** to indicate state — no background fills:

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
- Color-coded completion (tomato for completed sets/habits)
- Loading states during async operations
- Confirmation dialogs for destructive actions
- Badge system for categorization

## Component Architecture

### Three-Tier System

**Foundation Components**
Direct extensions of Radix UI components with design system tokens applied.

**Composite Components**
Reusable patterns combining multiple foundation components.

**Feature Components**
Domain-specific components built on composite patterns.

### Current Component Inventory

**Foundation:**
- `ExerciseTypeBadge` - semantic color mapping for exercise categorization
- Form controls with consistent styling
- Card layouts with standardized spacing

**Feature:**
- `ExerciseCard` - expandable exercise information display
- `WorkoutExerciseCard` - interactive workout tracking interface
- `WeightChart` - data visualization with custom styling

## Usage Guidelines

### Colors
- Use semantic color names (tomato, amber) rather than hex values
- `--brand-*` tokens for backgrounds, text, shadows
- Radix color scales (e.g. `var(--tomato-8)`) for component accents

### Shadows
- Always use `--shadow-warm-*` instead of generic `box-shadow`
- Cards get `--shadow-warm-sm`, elevated elements get `--shadow-warm`

### Animations
- `normal` (0.25s) for most interactions
- `fast` (0.15s) for hover states
- `slow` (0.35s) for page transitions
- Stagger children at 50ms increments using `animation-delay`

### Mobile
- Touch targets: minimum 44px on mobile (`min-height: 44px; min-width: 44px`)
- Inputs: `font-size: 16px` to prevent iOS auto-zoom
- Bottom padding: account for tab bar + safe area inset
