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
