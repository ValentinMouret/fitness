export const designTokens = {
  // Motion system - standardized timing and easing
  transitions: {
    fast: "0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    normal: "0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // Spacing extensions (complement Radix --space-* variables)
  spacing: {
    card: "var(--space-4)", // 16px - internal card padding
    section: "var(--space-6)", // 32px - between major sections
    page: "var(--space-8)", // 64px - page-level spacing
  },

  // Shadow system for elevation
  shadows: {
    subtle: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    elevated:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },

  // Interactive state colors
  interactions: {
    hover: "var(--gray-3)",
    focus: "var(--gray-4)",
    active: "var(--gray-5)",
    focusRing: "0 0 0 2px var(--accent-8)",
  },
} as const;

// Semantic color mappings
export const semanticColors = {
  // Status feedback
  success: "green",
  warning: "amber",
  error: "red",
  info: "blue",

  // Exercise type categorization
  exerciseTypes: {
    barbell: "yellow",
    bodyweight: "gray",
    cable: "blue",
    dumbbells: "amber",
    machine: "gold",
  },

  // Interactive element semantics
  interactive: {
    primary: "green",
    secondary: "gray",
    destructive: "red",
  },
} as const;

// Animation presets for common patterns
export const animations = {
  // Expandable content pattern
  expand: {
    maxHeight: { closed: "0px", open: "500px" },
    opacity: { closed: 0, open: 1 },
    transition: designTokens.transitions.normal,
  },

  // Icon rotation (chevrons, etc)
  rotate: {
    transform: { default: "rotate(0deg)", rotated: "rotate(180deg)" },
    transition: designTokens.transitions.normal,
  },

  // Loading state animation
  pulse: {
    opacity: { from: 1, to: 0.5 },
    transition: `${designTokens.transitions.normal} ease-in-out infinite alternate`,
  },
} as const;

// Layout constants
export const layout = {
  // Maximum content widths
  maxWidth: {
    card: "400px",
    form: "500px",
    content: "800px",
  },

  // Common breakpoints (for future responsive design)
  breakpoints: {
    mobile: "640px",
    tablet: "768px",
    desktop: "1024px",
  },
} as const;
