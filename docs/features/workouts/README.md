# Workouts

Fitness records training sessions and uses their history to help choose the next
workout. The goal is hypertrophy, with visibility into exercise progression,
muscle-group volume, and recovery.

## Core concepts

- A **workout** is a session with a start time, optional stop time, and ordered
  exercises. An ongoing session has started but has not stopped.
- An **exercise** has an identity, equipment type, movement pattern, and
  muscle-group contributions. Similar exercises remain distinct records.
- A **set** records planned and performed work, including reps, weight,
  completion, and warm-up/failure flags. Planned work is not evidence of
  completed training.
- A completed working set can have an optional post-set report of good reps left
  (`0`–`3`, `4+`, or `unsure`). Unanswered reports stay empty. Historical RPE
  remains stored separately for older workouts and generation context; the
  active workout flow does not ask for a new RPE.
- A **template** is reusable workout structure, not a completed session.

## Implemented entry points

The [route configuration](../../../app/routes.ts) includes:

| Route | Purpose |
| --- | --- |
| `/workouts` | Browse workouts |
| `/workouts/create` | Create a workout |
| `/workouts/:id` | View a session and log exercises and sets |
| `/workouts/templates` | Reuse workout templates |
| `/workouts/import` | Import training history |
| `/workouts/exercises` | Manage the exercise catalogue |
| `/workouts/recovery` | View recovery information |
| `/workouts/generate` | Generate and refine a workout with AI |
| `/workouts/:id/substitute/:exercise-id` | Substitute an exercise |

Session persistence and operations live in the
[workout session service](../../../app/modules/fitness/infra/workout-session.service.server.ts).
The [domain model](../../../app/modules/fitness/domain/workout.ts) owns workout
calculations and types; the [database schema](../../../app/db/schema.ts) owns
storage definitions.

## Generation

[AI generation](ai-generation.md) is the current generation-page flow. The
[adaptive generator](adaptive-generation.md) remains in the repository, but is
not offered as a fallback by that page. Do not assume the older equipment-selection
flow is still the generation UI.

## Open domain questions

Muscle-group overlap does not make two exercises interchangeable. Comparing
progress between a fly and a press, or inferring a barbell load from a dumbbell
load, needs an explicit model rather than assuming matching muscle groups imply
equivalent performance. Keep these questions separate from recording actual sets.
