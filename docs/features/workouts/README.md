# Workouts

Fitness records training sessions and uses their history to help choose the next
workout. The goal is hypertrophy, with visibility into exercise progression,
muscle-group volume.

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
  remains stored separately for older workouts; the
  active workout flow does not ask for a new RPE.
- Historical templates and import provenance remain stored for older sessions.
  New sessions start directly without a template picker.

## Implemented entry points

The [route configuration](../../../app/routes.ts) includes:

| Route | Purpose |
| --- | --- |
| `/workouts` | Browse workouts |
| `/workouts/create` | Start an empty workout with one action |
| `/workouts/:id` | View a session and log exercises and sets |
| `/workouts/import` | Import Fitbod training history |
| `/workouts/exercises` | Manage the exercise catalogue |
| `/workouts/:id/substitute/:exercise-id` | Substitute an exercise |

Session persistence and operations live in the
[workout session service](../../../app/modules/fitness/infra/workout-session.service.server.ts).
The [domain model](../../../app/modules/fitness/domain/workout.ts) owns workout
calculations and types; the [database schema](../../../app/db/schema.ts) owns
storage definitions.

## Retired entry points

Workout templates, Generate Workout, Strong import, AI Feedback, and Recovery Map
are retired. Their stored
history remains intact; this removal does not migrate or delete past sessions.
Fitbod import and [exercise substitution](adaptive-generation.md) remain available.

Coaches can create a current or past session through MCP and read history and
muscle volume. Future weekly planning is not implemented by this change; see
[MCP tools](../../mcp.md) for the current contract.

## Open domain questions

Muscle-group overlap does not make two exercises interchangeable. Comparing
progress between a fly and a press, or inferring a barbell load from a dumbbell
load, needs an explicit model rather than assuming matching muscle groups imply
equivalent performance. Keep these questions separate from recording actual sets.
