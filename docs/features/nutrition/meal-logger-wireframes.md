# Meal logger interaction proposal

Status: Draft. This mobile sketch explores the daily logging flow; it is not a
record of the current screen. Read the [meal logger specification](meal-logger.md)
for implemented behaviour and unresolved scope. Use the shared
[design system](../../design/design-system.md) rather than adding feature-local tokens.

## Review the day and choose a meal

Keep the date, daily progress, and four meal categories in one vertical flow.
Example totals illustrate layout only.

```text
┌──────────────────────────────┐
│ ← Monday, Aug 2   Today   →   │
├──────────────────────────────┤
│ Daily intake                 │
│ Calories ███████░ 1847 / 2100 │
│ Protein  █████░░░   98 / 140  │
│ Remaining: 253 kcal, 42 g     │
├──────────────────────────────┤
│ Breakfast                [+] │
│ Oatmeal and berries      [⋯] │
│ Meal nutrition summary       │
│ [Edit meal]                  │
├──────────────────────────────┤
│ Lunch                    [+] │
│ No meal logged               │
│ [Use template] [Build meal]  │
├──────────────────────────────┤
│ Dinner                   [+] │
│ Chicken and rice         [⋯] │
│ Meal nutrition summary       │
│ [Edit meal]                  │
├──────────────────────────────┤
│ Snacks                   [+] │
│ No meal logged               │
└──────────────────────────────┘
```

An empty category is a lack of records, not an incomplete task to penalise. Keep
logged meals editable without losing their original date and category context.

## Choose a logging method

Offer template selection or meal composition for the selected date and category.
Preview template nutrition before applying it; use the builder for portion
changes. AI estimation should be labelled as estimation rather than precise
ingredient measurement.

```text
┌──────────────────────────────┐
│ Log lunch                [×] │
│ Monday, Aug 2                │
├──────────────────────────────┤
│ [Use template] [Build meal]  │
│ [Estimate meal]              │
│                              │
│ Templates                    │
│ Chicken salad                │
│ Nutrition summary            │
│ [Use] [Modify portions]      │
└──────────────────────────────┘
```

Reuse the [builder's ingredient interaction](meal-builder-wireframes.md) rather
than maintaining a second quantity-editing model.

## Actions and feedback

- Keep removal and template-saving actions associated with their meal.
- Preserve date context after saving or cancelling an edit.
- Make pending saves visible and prevent accidental duplicate submissions.
- Confirm destructive actions and show errors without discarding the user's work.
- Use semantic labels and accessible controls, not colour or icons alone.

## Deferred interaction ideas

Copying yesterday's meals, recent-item recommendations, favourites, and explicit
meal-completion markers were part of earlier sketches. They need product decisions
before implementation; this document does not make them current requirements.
