# Design System

The Fitness app design system provides a cohesive foundation for building consistent, accessible, and maintainable user interfaces. Built on top of Radix UI, it extends the base component library with fitness-specific patterns and design tokens.

## Design Principles

### Light & Minimalist
The design prioritizes clarity and simplicity, reducing cognitive load while maintaining visual hierarchy and functionality.

### Consistent Interactions  
All interactive elements follow predictable patterns for expanding content, inline editing, and state feedback.

### Semantic Color Usage
Colors convey meaning through consistent application: green for success/completion, red for destructive actions, and contextual colors for categorization.

### Smooth Transitions
All animations use consistent timing and easing to create cohesive, polished interactions.

## Foundation

### Theme Configuration
```typescript
// root.tsx
<Theme accentColor="green" grayColor="sand" radius="large">
```

- **Accent Color**: Green - used for primary actions, completion states, and success feedback
- **Gray Scale**: Sand - provides warm, approachable neutral tones  
- **Border Radius**: Large - creates friendly, approachable interfaces

### Typography
- **Font Family**: Lato - clean, readable sans-serif optimized for digital interfaces
- **Scale**: Uses Radix UI's type scale (1-9) for consistent sizing and hierarchy

## Design Tokens

### Motion System
```typescript
export const transitions = {
  fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',    // Quick interactions
  normal: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',  // Standard animations  
  slow: '0.35s cubic-bezier(0.4, 0, 0.2, 1)',    // Complex state changes
};
```

### Spacing Extensions
```typescript
export const spacing = {
  card: 'var(--space-4)',     // 16px - internal card padding
  section: 'var(--space-6)',  // 32px - between major sections
  page: 'var(--space-8)',     // 64px - page-level spacing
};
```

### Semantic Colors
```typescript
export const semanticColors = {
  // Status feedback
  success: 'green',    // Completed actions, positive states
  warning: 'amber',    // Cautionary states, pending actions
  error: 'red',        // Destructive actions, error states
  info: 'blue',        // Informational content, neutral actions
  
  // Exercise categorization
  exerciseTypes: {
    barbell: 'yellow',
    bodyweight: 'gray', 
    cable: 'blue',
    dumbbells: 'amber',
    machine: 'gold',
  }
};
```

## Component Patterns

### Expandable Cards
Used throughout the app for progressive disclosure of information.

**Key Features:**
- Smooth expand/collapse animations
- Chevron icon rotation
- Clickable header area
- Optional action menus

**Current Usage:**
- `ExerciseCard` - exercise details and muscle group breakdown
- `WorkoutExerciseCard` - workout sets and tracking interface

### Inline Editing
Real-time editing pattern for workout data entry.

**Key Features:**
- Auto-submit on field change
- Visual focus states
- Loading feedback during submission
- Transparent backgrounds with hover/focus highlights

**Current Usage:**
- Set reps, weight, and notes in workout tracking
- Form fields with immediate persistence

### Status Feedback
Clear visual indication of states and actions.

**Key Features:**
- Color-coded completion (green backgrounds for completed sets)
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

## Implementation Status

### ✅ Established Patterns
- Radix UI theme configuration
- Consistent color semantics
- Animation patterns for expandable content
- Inline editing with auto-submit behavior

### 🔄 In Progress  
- Design token standardization
- Component pattern extraction
- Animation timing consistency

### 📋 Planned
- Composite component library
- Comprehensive component documentation  
- Accessibility guidelines
- Usage examples and best practices

## Usage Guidelines

### Color Application
- Use semantic color names rather than direct Radix color references
- Apply success/error colors consistently across similar interactions
- Maintain exercise type color mapping for categorization

### Animation Standards
- Use `normal` transition timing for most interactions
- Apply `fast` timing for hover states and micro-interactions  
- Reserve `slow` timing for complex state changes or page transitions

### Component Composition
- Build new components using established patterns
- Prefer composition over customization
- Maintain consistent spacing and layout approaches

---

*This design system is a living document that evolves with the application. Updates should reflect both current usage patterns and future design intentions.*