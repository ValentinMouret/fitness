# Meal builder interaction proposal

Status: Draft. This is a mobile interaction reference, not a screenshot or an
acceptance record of the current UI. Read the [meal builder specification](meal-builder.md)
for implemented behaviour and scope. Shared styling and accessibility requirements
come from the [design system](../../design/design-system.md) and
[frontend guide](../../engineering/frontend.md).

## Compose a meal on one screen

Keep objectives, totals, and ingredient quantities visible in a single-column
flow. The values below illustrate layout, not a nutritionally calculated meal.

```text
┌──────────────────────────────┐
│ ← Meal builder               │
├──────────────────────────────┤
│ Objectives                   │
│ Calories     [700] kcal       │
│ Protein      [ 30] g          │
│ Carbs        [  ] optional    │
│ Fat          [  ] optional    │
│ Desired satiety  [1–5]        │
├──────────────────────────────┤
│ Current totals               │
│ Calories  ███████░ 650 / 700  │
│ Protein   ██████░░  25 / 30   │
│ Satiety estimate   ●●●●○     │
│ [How is this estimated?]     │
├──────────────────────────────┤
│ Ingredients                  │
│ Chicken breast           [⋯] │
│ [━━━━●━━━━━━━━]  [150] g     │
│ Ingredient nutrition summary │
│                              │
│ Rice                     [⋯] │
│ [━━●━━━━━━━━━━]  [ 80] g     │
│ Ingredient nutrition summary │
│                              │
│ [+ Add ingredient]            │
├──────────────────────────────┤
│ [Save template] [Log meal]    │
└──────────────────────────────┘
```

Show the logging action only in a dated meal-logging context; otherwise saving a
template is the primary persistence action.

## Adjust quantities and objectives

- Provide a slider for common adjustments and direct gram input for precision.
- Use ingredient-appropriate ranges and label the units.
- Support keyboard slider controls and touch targets from the design system.
- Recalculate totals from the selected quantities; do not independently store
  totals that can disagree with the ingredient list.
- Leave optional macro targets empty when not set. Do not interpret an empty
  target as a goal of zero.
- Explain conflicting calorie/macro objectives near the relevant inputs.

## Add ingredients

Open a searchable ingredient picker with category filtering. Show nutrition per
100 g so entries can be compared consistently. Keep AI ingredient lookup and its
review step distinguishable from selecting an existing library entry.

## Explain satiety without overstating precision

An expandable explanation can show which inputs affect the score. Label both the
score and any fullness duration as estimates. Calculation constants and thresholds
belong in the domain implementation, not this wireframe.

## Feedback states

- Show pending state for remote searches and saves.
- Keep the composed meal available after a failed save and offer a retry.
- Show validation next to the affected input and make status changes accessible.
- Do not make successful composition depend on AI availability.

Reordering, swipe-to-delete with undo, and richer meal suggestions are interaction
ideas, not acceptance requirements inferred from this sketch.
