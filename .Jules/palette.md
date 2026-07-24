# Palette's Journal

## 2026-07-24 - [Multi-Step Wizard Parity & Accessibility]
**Learning:** Copy-pasted wizard flows (like creating vs. editing a habit) are prone to accessibility and polish regressions if features like focus management, tooltips, and keyboard shortcuts are only applied to one and not kept in sync. Aligning both with the "Semantic Form & Keyboard Navigation Pattern" ensures high-fidelity interaction and accessibility parity across CRUD lifecycles.
**Action:** Always audit both creation and editing wizards simultaneously to ensure identical UX features, semantic labelling, autofocusing, and keyboard navigation.

## 2026-07-22 - [Conditionally-Rendered Dialog Input Focus]
**Learning:** For conditionally-rendered input fields nested within dialogs (e.g., entering a template name only after selecting 'Save as template'), standard dialog auto-focus patterns like `onOpenAutoFocus` are insufficient because the input is initially unmounted. Using a localized `useRef` and a `useEffect` hook watching the conditional state allows for programmatically focusing the input immediately upon rendering, keeping keyboard-only flows fluid.
**Action:** Use a ref and a visibility state listener with a micro-tick timeout to manage focus on nested conditionally-rendered dialog input elements.

## 2025-05-15 - [Identity-Focused Habit UI]
**Learning:** The app's philosophy (based on Atomic Habits) emphasizes "Identity Phrases" (e.g., "I am the type of person who..."). Surfacing these phrases during the interaction loop (like habit checking) reinforces the identity-building aspect of the habit, making the UX more meaningful than a simple checkbox.
**Action:** Always look for opportunities to surface identity phrases or habit descriptions in tooltips or subtext when the user interacts with habits.

## 2025-05-15 - [Improving Action Feedback in Lists]
**Learning:** When using fetchers in lists, using only 'fetcher.state === "loading"' creates global loading states that affect all items. Checking 'fetcher.formData' for specific IDs/intents enables precise, per-item feedback.
**Action:** Always derive loading states from both 'fetcher.state' and 'fetcher.formData' when working with collections.

## 2025-05-15 - [Icon Button Accessibility]
**Learning:** Icon-only buttons are common in Radix UI-based apps but are often missing 'aria-label', making them opaque to screen readers.
**Action:** Proactively check all 'IconButton' and drag handle elements for descriptive 'aria-label' attributes.

## 2026-04-22 - [Radix UI Loading vs Disabled States]
**Learning:** When using the Radix UI `loading` prop on `Button` or `IconButton`, setting `disabled={true}` alongside it can make the loading spinner less visible due to the reduced opacity of the disabled state.
**Action:** Prefer relying on the `loading` prop for visual feedback during async operations, only using `disabled` if the action must be strictly blocked and the visual dimming is desired.

## 2026-04-22 - [Reinforcing Identity in Accessibility Labels]
**Learning:** For apps following "Atomic Habits" principles, identity phrases (e.g., "I am the type of person who...") are as important as the habit name. Including them in `aria-label` ensures screen reader users also receive this psychological reinforcement.
**Action:** Ensure `aria-label` for habit-related actions includes the identity phrase when available.

## 2026-04-22 - [Standardizing Identity Phrase Naming]
**Learning:** Generic names like `habitDescription` dilute the identity-focused intent of the application. Using `identityPhrase` consistently across components and routes clarifies developer intent and aligns the UI with the underlying domain model.
**Action:** Favor specific domain terminology (like `identityPhrase`) over generic descriptors in component props.

## 2026-04-24 - [Keyboard Shortcut Hygiene]
**Learning:** Global keyboard listeners (e.g., 'q' for Quick Actions) must be carefully scoped to avoid interfering with system shortcuts (verify no modifier keys like Ctrl/Cmd are pressed) and user input (verify focus is not in an input, textarea, or contentEditable element).
**Action:** Always include checks for `!e.ctrlKey && !e.metaKey && !e.altKey` and `isInput` target detection when implementing global shortcuts.

## 2026-04-26 - [Keyboard Shortcut Discovery & Accessibility]
**Learning:** Adding global shortcuts (like 'q' for Quick Actions) requires clear visual cues (e.g., `<Kbd>` component) for discovery and proper accessibility attributes (`aria-keyshortcuts`, `aria-label`). Visual hints should be hidden on mobile where physical keyboards are less common.
**Action:** When adding shortcuts, always include a visual `<Kbd>` badge on the associated element and ensure accessibility attributes are updated.

## 2026-05-18 - [Accessible Date Navigation & Discovery]
**Learning:** Date-based navigation is a core interaction pattern. Adding a "Today" jump-link and keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `t`) significantly improves "power user" efficiency. To ensure discovery without cluttering the UI, include the shortcut hints in tooltips (e.g., "Next day (Right Arrow)") and use `aria-keyshortcuts`.
**Action:** Implement a standard "Today" button and keyboard listeners for date-navigated pages. Use absolute positioning for the "Today" button within a relative container to keep the main date heading centered.

## 2026-05-06 - [Global Optimistic Progress & Celebrations]
**Learning:** To trigger celebration effects (like confetti) only upon completion of the final item in a list, implement a `useEffect` that monitors an optimistic count (derived via `useFetchers()`) and compares it against a persistent 'previously completed' state or ref initialized from server data. This prevents the celebration from re-triggering on every page load if the user is already finished.
**Action:** Use a combination of `useFetchers()` for the current count and a `previouslyCompleted` ref or state to guard celebration triggers.

## 2026-05-06 - [Action Success Feedback]
**Learning:** Providing immediate, container-level visual feedback (like a pulse) for actions that might take a moment to reflect in the data (due to network latency) greatly improves perceived performance. Binding the `trigger` prop of such feedback components to the existence of relevant fetchers ensures the feedback is "live".
**Action:** Wrap action-heavy sections in a feedback component (e.g., `SuccessPulse`) triggered by relevant fetcher states.

## 2026-05-28 - [Accessible Discovery for Icon Buttons]
**Learning:** Icon-only buttons with `aria-label` satisfy screen reader requirements but can be opaque to sighted users. Wrapping these in a Radix UI `Tooltip` that matches the `aria-label` provides necessary visual context on hover/focus. When used with `DropdownMenu.Trigger` or `AlertDialog.Trigger`, the `Tooltip` should be the outermost wrapper to ensure correct ref and event propagation.
**Action:** Consistently wrap icon-only interactive elements in a `Tooltip`. For composite Radix components, always follow the `<Tooltip><Trigger><IconButton /></Trigger></Tooltip>` nesting order.

## 2025-05-29 - [Dashboard Efficiency: Keyboard Shortcuts]
**Learning:** For primary daily actions like weight logging, adding a simple keyboard shortcut (e.g., 'w') significantly improves user efficiency. To ensure discovery, reinforce the shortcut with a visual `<Kbd>` hint and an informative Tooltip that explicitly mentions the trigger key.
**Action:** Identify high-frequency single-input actions and implement single-key shortcuts with appropriate discovery hints and input-focus guards.

## 2025-05-30 - [Efficient Modal Interactions & Shortcuts]
**Learning:** For modal-based editing features (like the Daily Note), the interaction loop is tightened by supporting 'Escape' to go back/close, 'E' to enter edit mode, and 'Cmd/Ctrl + Enter' for quick submission. Auto-focusing the input (using a ref/effect to bypass linting) makes the feature feel immediate and "active".
**Action:** Implement a standard set of shortcuts (Esc, E, Cmd+Enter) and focus management for all modal-based form interactions.

## 2025-06-03 - [Accessible Pagination Landmarks]
**Learning:** Pagination controls are critical navigation elements that should be wrapped in a semantic `<nav>` element with a descriptive `aria-label` (e.g., "Pagination") to provide a clear landmark for screen reader users. Individual buttons should have descriptive labels (e.g., "Go to next page") to provide more context than simple "Next" text, and decorative icons should be hidden with `aria-hidden="true"` to avoid redundant audio output.
**Action:** Always wrap pagination components in a `<nav>` with `aria-label` and ensure navigation buttons have explicit, descriptive `aria-label` attributes.

## 2025-06-05 - [Bi-directional Highlighting for Visual Maps]
**Learning:** For complex visual maps (like a body map) linked to a data list, bi-directional highlighting (lifting hover state to a common parent) significantly improves the connection between visual elements and their textual descriptions, making the UI feel more integrated and responsive.
**Action:** Implement shared hover state in a parent component when visual maps and data lists represent the same entities.

## 2025-06-05 - [Accessibility for Custom Progress Bars]
**Learning:** Custom progress bars built with primitive elements (e.g., `Box` or `div`) must explicitly include `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to be accessible. Even high-level components like Radix `Progress` require a descriptive `aria-label` if their purpose isn't immediately obvious from context.
**Action:** Always verify ARIA attributes on both custom and component-library progress indicators.

## 2026-06-08 - [Scalable Header Shortcuts]
**Learning:** Hardcoding shortcuts for page-specific primary actions in global layouts creates brittle code. Elevating shortcut configuration to the `PageHeader` component and having the layout dynamically respond to the active page's header config allows for a scalable and maintainable "power user" experience.
**Action:** Use the `PageHeader.primaryAction.shortcut` property to implement page-level shortcuts, and ensure the global listener in `AppLayout` remains the single source of truth for handling these triggers.

## 2024-06-12 - [Accessible Status Updates & Metric Clarity]
**Learning:** Screen reader users often miss visual "All Done" messages or percentage-based metrics if they aren't explicitly announced. Using 'role="status"' and 'aria-live="polite"' for completion messages, and 'aria-valuetext' for custom progress indicators, ensures these moments of delight and information are accessible to everyone.
**Action:** Always wrap completion messages in status regions and provide human-readable 'aria-valuetext' for custom progress bars.

## 2024-06-12 - [Discovery Hints for Page Navigation]
**Learning:** Standardizing shortcut hints (like <Kbd>T</Kbd> for Today) across different date-navigated pages reinforces the application's "power user" patterns. Including these hints inside the buttons themselves (on desktop) improves discovery without cluttering the mobile UI.
**Action:** Include <Kbd> hints in primary navigation actions when a global shortcut is available.

## 2024-06-10 - [Accessible Micro-UX for Habits]
**Learning:** Custom SVG-based progress rings and decorative emojis often lack semantic meaning for assistive technologies. Adding standard ARIA attributes (`role="progressbar"`) and wrapping emojis in labeled `span` elements with `role="img"` ensures these features are delightful for all users. Surfacing identity phrases in Tooltips during the habit-checking interaction loop further strengthens the identity-building core of the application.
**Action:** Proactively audit custom visual indicators for ARIA compliance and use Tooltips to surface reinforcement text (like identity phrases) on primary interaction triggers.

## 2026-06-12 - [Measurement Entry Power Shortcuts]
**Learning:** For detail pages centered around a single value input (like specific measurement tracking), adding an 'm' shortcut to focus the input field significantly streamlines data entry. This pattern is most effective when reinforced by a visual <Kbd> hint in the SectionHeader and an aria-keyshortcuts attribute on the input.
**Action:** Use 'm' as a standard shortcut for focusing primary measurement value inputs across detail pages.

## 2025-06-15 - [Modal Focus Management & Async Feedback]
**Learning:** In conversational or result-focused modals (e.g., AI feedback), users often want to immediately act on or dismiss the result. Shifting focus to the "Close" or "Accept" button once the async result is generated (using `useRef` and `useEffect`) optimizes the keyboard flow. Additionally, using `role="status"` and `aria-live="polite"` on loading states ensures screen reader users are kept informed of the background process.
**Action:** Implement automatic focus transitions in modals upon async completion and always wrap loading states in ARIA live regions.

## 2026-06-13 - [Precise Multi-Fetcher Feedback]
**Learning:** In pages with multiple concurrent actions (like the Nutrition dashboard), relying on a single `fetcher` hook leads to race conditions and incorrect UI states if the user triggers another action before the first one finishes. Using `useFetchers()` to monitor the entire fetcher pool allows for precise, item-specific feedback even during rapid interactions.
**Action:** Use `useFetchers()` to derive item-specific loading and success states in list views where multiple background actions are supported.

## 2026-06-15 - [Context-Aware Empty States & Filter Persistence]
**Learning:** For search and filtering interfaces, distinguishing between "no data" and "no results" empty states improves clarity. Using the `EmptyState` component with a primary action (e.g., "Add Exercise") for empty collections, and a recovery action (e.g., "Clear Filters") when active filters yield no matches, provides a a clear path forward. Syncing input values with URL `searchParams` ensures the UI remains consistent with the filtered state.
**Action:** Implement dual-path empty states and bind filter inputs to URL parameters in all searchable collection views.

## 2025-06-18 - [Dialog Keyboard Navigation & Discovery]
**Learning:** When interactive elements use `all: unset` for custom styling (common in list-based dialogs like 'Start Workout'), they lose default browser focus rings, making them invisible to keyboard users. Adding programmatic shortcuts (e.g., 'F' for 'Fresh', '1-9' for templates) and visual `<Kbd>` hints significantly accelerates the interaction for power users while ensuring the dialog remains accessible.
**Action:** Always verify `:focus-visible` states when using `all: unset` and consider 'accelerator' keys (F, 1-9) for high-frequency dialog selections.

## 2024-06-20 - [Contextual Accessibility for Workout Progress]
**Learning:** Generic progress percentages (e.g., "30%") lack context in a workout setting. Using `aria-valuetext` to provide a human-readable summary (e.g., "3 of 10 sets completed") significantly improves the experience for screen reader users by providing absolute progress context alongside relative percentage.
**Action:** Use `aria-valuetext` on progress bars to provide domain-specific context (e.g., set counts, task completion) that complements the numerical percentage.

## 2024-06-20 - [Standardizing 'Add' Shortcuts]
**Learning:** Users naturally look for a way to add new items in active sessions. Standardizing the 'n' shortcut for "Add Exercise" in workout sessions (matching the pattern in the Exercise index and Daily Notes) creates a consistent and predictable "power user" language across the application. Discovery is ensured by adding `aria-keyshortcuts` and visual `<Kbd>` hints.
**Action:** Use 'n' as the standard shortcut for "New" or "Add" primary actions within a context, and always provide both visual and ARIA-based hints.

## 2026-06-25 - [Accessible & Robust Form Entry]
**Learning:** For critical entry points like login, standardizing accessibility and usability features (unique `useId` for label association, `autoComplete` hints, and `aria-hidden` on decorative required indicators) significantly improves the experience for both screen reader users and those using password managers. Providing immediate visual feedback through `loading` states on buttons via `useNavigation` makes the interface feel more responsive.
**Action:** Apply the "Semantic Form Pattern" (useId, semantic label, autoComplete, loading button) to all primary data entry forms.

## 2026-06-25 - [SPA Navigation Consistency]
**Learning:** Mixing standard `<a>` tags with router `<Link>` components for internal navigation causes inconsistent behavior (full page reloads vs. SPA transitions), which breaks the "smooth" feel of the app and discards ephemeral state.
**Action:** Proactively replace `<a>` tags with `<Link>` for all internal application routes, especially for 'Cancel' and 'Back' actions.

## 2025-06-21 - [Tooltip Visibility for Disabled Elements]
**Learning:** In Radix UI Themes, `Tooltip` triggers often fail when they wrap a `disabled` element (like a `Button`) because the element doesn't fire the necessary mouse events. Wrapping the disabled element in a `Box` with `display="inline-block"` provides a non-disabled surface that correctly triggers the tooltip.
**Action:** Always wrap disabled interactive elements in a `Box` when they are inside a `Tooltip`.

## 2024-06-28 - [Accessible Toggle Semantic & Progress Context]
**Learning:** For custom-built toggle elements (like habit cards) and progress rings, standard visual cues (colors, checkmarks) aren't enough for screen reader users. Adding 'aria-pressed' to toggles and 'aria-valuetext' to progress indicators provides the necessary semantic state and completion context (e.g., "3 of 5 habits completed") that makes the interface truly accessible.
**Action:** Always include 'aria-pressed' on custom toggle buttons and provide human-readable 'aria-valuetext' for progress components.

## 2026-07-08 - [Optimistic Habit Completion & Celebrations]
**Learning:** page-level optimistic UI using `useFetchers()` significantly improves the perceived performance of high-frequency actions like habit checking. combining this with a `Celebration` component triggered by a `useEffect` and `useRef` completion-guard creates a cohesive and delightful feedback loop.
**Action:** favor page-level optimistic state aggregation for primary interaction loops and use `useRef` to safely trigger one-time "delight" effects based on state transitions.

## 2026-07-15 - [The Semantic Form Entry Pattern]
**Learning:** Standardizing the accessibility and interaction details of entry forms (like creating a new Measurement) makes them highly polished. This is achieved by combining unique `useId`s for label-to-input association, visual indicators (`RequiredStar`), autofocusing the first input on mount (using `useRef` and `useEffect` to satisfy linters), adding `Cmd+Enter` / `Ctrl+Enter` shortcut handlers with `aria-keyshortcuts` + `Tooltip` hints, and utilizing `useNavigation` to provide disable/loading states.
**Action:** Apply the full Semantic Form Entry Pattern to all standard input/creation form pages.

## 2026-07-18 - [Standardizing Page Headers across Routes]
**Learning:** Standardizing page headers across routes by exporting a `handle` object with a `header` function (which receives loaderData, allowing dynamic titles like 'Edit {name}') is extremely elegant and clean. This integrates pages with the global layout's `<PageHeader />`, ensures consistent navigation transitions, and automatically equips back buttons with standardized Radix UI Tooltips and ARIA support.
**Action:** Always favor page-level header handles over custom header layouts in page components for standard CRUD and form routes.
