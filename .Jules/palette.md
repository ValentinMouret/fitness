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
