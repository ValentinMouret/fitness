# Palette's Journal

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
