# Nutrition

Nutrition connects meal composition, actual food intake, and calorie/macro targets.
This is a personal tracking tool, not a multi-user diet platform.

## Core concepts

- An **ingredient** has nutritional values per quantity and may carry texture and
  water/fibre information used by satiety estimates.
- A **meal template** is one reusable composition of ingredients and quantities,
  explicitly assigned to one or more meal times. Existing templates retain their
  original assignment. Management filters All/Breakfast/Lunch/Dinner/Snacks;
  Save and Cancel retain the filter. A picker offers only assigned templates and
  the log retains its chosen meal time. Assignment changes do not alter past logs.
- A **meal log** records consumption on a date in a meal category. It is distinct
  from a template or an unlogged composition.
- A **target** describes intended intake; logged intake is the actual record.
  Dashboard and nutrition use only the account's saved calorie target. When none
  is saved, the existing example values remain visibly labeled as defaults with
  a link to set personal targets. Defaults are display values, never saved goals.
  A target read failure is an error, not evidence that the account has no target.

The [nutrition domain](../../../app/modules/nutrition/domain/) and
[database schema](../../../app/db/schema.ts) define the implemented types and
storage. Keep data definitions there rather than copying schema into these pages.

## Workflows

- [Meal builder](meal-builder.md): select ingredients, adjust quantities, and
  save a template or log a meal.
- [Meal logger](meal-logger.md): record daily intake and compare it with targets.
- [Builder wireframes](meal-builder-wireframes.md) and
  [logger wireframes](meal-logger-wireframes.md): draft interaction references,
  not screenshots of the current application.

The routes also include target calculation, AI meal estimation, and public meal
sharing. These capabilities should not be confused with broader proposals such as
community templates or an offline logging system.
