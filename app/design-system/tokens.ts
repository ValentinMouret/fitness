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

  // Warm shadow system for elevation
  shadows: {
    subtle: "0 1px 2px rgba(0, 0, 0, 0.04)",
    card: "0 2px 8px rgba(0, 0, 0, 0.06)",
    elevated: "0 4px 16px rgba(0, 0, 0, 0.08)",
    hover: "0 4px 12px rgba(0, 0, 0, 0.10)",
  },

  // Interactive state colors
  interactions: {
    hover: "var(--gray-3)",
    focus: "var(--gray-4)",
    active: "var(--gray-5)",
    focusRing: "0 0 0 2px var(--accent-8)",
  },
} as const;

// Warm brand colors
export const brandColors = {
  background: "#faf9f7",
  surface: "#f3f1ed",
  coral: "#e15a46",
  amber: "#f59e0b",
  success: "#22c55e",
  text: "#1c1917",
  textSecondary: "#79756d",
} as const;

/**
 * Semantic color mappings
 *
 * Color usage rules:
 * - tomato: Primary actions, active nav, CTAs, completed states (habits, sets)
 * - green: Success feedback (toasts, confirmations) - NOT for completed states
 * - orange: In-progress states (active workout, warmup sets)
 * - amber: Pending states, attention needed
 * - red: Destructive actions (delete, logout)
 * - blue: Informational content
 */
export const semanticColors = {
  // Primary action color (tomato)
  primary: "tomato",

  // Status feedback
  success: "green", // For toasts/confirmations only
  warning: "amber",
  inProgress: "orange",
  error: "tomato",
  destructive: "red",
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
    primary: "tomato",
    secondary: "gray",
    destructive: "red",
  },
} as const;

// Chart colors for data visualization (warm palette)
export const chartColors = {
  protein: "#e15a46",
  carbs: "#f59e0b",
  fat: "#a3846f",
  primary: "#e15a46",
  secondary: "#f59e0b",
  tertiary: "#22c55e",
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

  // Page entrance animation
  entrance: {
    initial: { opacity: 0, transform: "translateY(12px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
    transition: "0.4s ease-out",
  },

  // Celebration pulse
  celebrate: {
    keyframes: "pulse-glow 0.6s ease-out",
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

  // Common breakpoints
  breakpoints: {
    mobile: "640px",
    tablet: "768px",
    desktop: "1024px",
  },
} as const;
