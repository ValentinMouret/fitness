# Meal builder

Status: Core flow implemented. The behaviour below is based on code inspection;
proposed extensions are listed separately.

The meal builder at `/nutrition/meal-builder` lets the owner compose a meal against
calorie and macro objectives, adjust ingredient quantities, and save the result
as a template or a dated meal log. See the [nutrition overview](README.md) for
these concepts and the [draft wireframes](meal-builder-wireframes.md) for UX intent.

## Current workflow

1. Set calorie, protein, and optional carbohydrate/fat objectives, plus a desired
   satiety level.
2. Search the ingredient library and choose ingredients.
3. Adjust quantities and review calculated calories, macros, fibre, volume, and
   satiety feedback.
4. Save a named, categorised template, or save the composition as a meal log when
   opened with a meal category, date, and return destination.

Existing meal logs can be loaded for editing. AI ingredient search and review
can create an ingredient in the library, so the older restriction to predefined
raw ingredients no longer describes the application.

## Nutrition and satiety

Nutritional totals derive from ingredient values and quantities. Ingredient
quantity ranges and direct entry should support precise adjustment without
making common portions tedious to enter.

Satiety is a heuristic based on protein, fibre, volume relative to calories, and
quantity-weighted texture modifiers. The UI presents a five-level result and an
estimated fullness duration. The calculation and thresholds belong in
[meal-template.ts](../../../app/modules/nutrition/domain/meal-template.ts), with
quantity calculations in [ingredient.ts](../../../app/modules/nutrition/domain/ingredient.ts).

These estimates are not evidence of individually validated fullness predictions.
The former specification's claim of expert validation had no supporting source;
do not use it as justification for the formula or duration estimates.

## Boundaries

Saving a template does not record consumption. Logging requires a date and meal
category. A modified logged meal should not silently rewrite a reusable template.

The builder provides local suggestions based on objectives and totals. AI
ingredient lookup is a separate capability from a general AI meal optimiser.
Shared colours, controls, and motion follow the
[design system](../../design/design-system.md), not feature-local tokens.

## Implementation references

- [Builder route](../../../app/routes/nutrition/meal-builder.tsx)
- [Loading, saving, and AI ingredient operations](../../../app/modules/nutrition/infra/meal-builder.service.server.ts)
- [Meal templates](../../../app/modules/nutrition/domain/meal-template.ts)

## Proposed extensions

Status: Draft; not committed requirements.

- Collect post-meal hunger feedback to evaluate or personalise satiety estimates.
- Suggest ingredient combinations with flavour compatibility, not only macro gaps.
- Import recipes or support multi-meal planning and shopping lists.

Before expanding scope, decide how raw/cooked quantities and composite foods
should be represented. Micronutrient tracking, budget optimisation, and barcode
scanning were excluded from the original MVP and need a new decision before
being treated as requirements.
