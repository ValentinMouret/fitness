# Meal logger

Status: Core flow implemented. The behaviour below is based on code inspection,
not a browser acceptance run.

The daily nutrition page at `/nutrition` records actual intake across breakfast,
lunch, dinner, and snacks. The older `/nutrition/meals` route redirects there,
preserving the selected date. See the [nutrition overview](README.md) for the
model and [draft wireframes](meal-logger-wireframes.md) for interaction proposals.

## Current workflow

- Navigate by date and review daily calorie/macro totals.
- Apply a saved template to a meal category.
- Use the [meal builder](meal-builder.md) to compose or edit a dated meal.
- Delete an incorrect log or save a logged composition as a reusable template.
- Use AI quick estimation as another intake-entry path.
- Make a template public or private for sharing through a read-only link.

Public template sharing exists; community discovery and accountability partners
are not implied by it.

## Targets and actual intake

Logs describe consumption; templates describe reusable compositions. Applying a
template creates a log rather than making the template itself a dated record.

The daily-page service reads the current calorie target and derives macro targets
using a 30% protein, 40% carbohydrate, and 30% fat calorie split. The UI has default
targets when no active target is available. This is current behaviour, not a claim
that all target-calculation paths use one unified model.

An empty meal category means no intake was recorded there. It is not evidence
that the owner intentionally skipped a meal or completed a fasting goal.

## Implementation references

- [Daily page and actions](../../../app/routes/nutrition/index.tsx)
- [Daily summary, templates, and sharing operations](../../../app/modules/nutrition/infra/meals-page.service.server.ts)
- [Meal-log domain](../../../app/modules/nutrition/domain/meal-log.ts)
- [AI estimation endpoint](../../../app/routes/api/nutrition/estimate-meal.ts)
- [Public meal route](../../../app/routes/share/meal.tsx)

## Proposed extensions and open decisions

Status: Draft; not committed requirements.

- Copy yesterday's meals or duplicate a meal to another date.
- Add explicit partial/complete meal states if they provide value beyond intake logs.
- Suggest templates from recent usage and meal timing.
- Add gentle logging reminders or longer-term nutrition insights.

Offline logging and synchronisation were requested in the original specification,
but are not established capabilities of the documented route/action flow. They
need a separate design covering local storage, conflicts, and retry behaviour.

Before adding planning features, decide how to represent cooked batches split
across meals and how planned intake differs from actual consumption. Export and
retention policy also need explicit decisions rather than generic product metrics.
