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
- Active and completed sessions share an overview of ordered exercises at
  `/workouts/:id`. Each exercise has its own screen at
  `/workouts/:id/exercises/:exerciseId` with Previous and Next; links that
  still use the older `?exercise=` parameter redirect there. Completing a set
  never moves to another exercise.
- On an exercise screen, a planned value (`targetReps`) is shown dashed until
  reps are entered; ticking a set without reps logs the plan. Tapping a set
  number toggles warm-up; warm-ups show "W" and working sets are numbered from
  one. Unticking a set or marking it as a warm-up discards its effort report.
  Added sets are appended after the last set.
- Completing a working set asks for the effort report in a sheet; dismissing it
  leaves the report empty. Completing a set starts a client-side rest timer that
  survives moving between screens; its length is a device preference chosen
  from presets, and warm-ups rest at most a minute.
- An exercise added mid-workout starts with one set planned from its last
  finished session. The picker shows when each exercise was last done.
- Finish workout is available in the overview when the session has sets.
  Unfinished sets require confirmation and remain uncompleted after finishing;
  saved sets are retained. Saving the final remaining set opens confirmation
  automatically. Only explicit confirmation stops the workout; Keep training
  returns to logging. Finishing shows a summary of duration, sets and exercises.
- Active sessions can be cancelled from Workout actions after confirmation. This
  removes the session and its sets without marking it finished.
- Completed sessions show Completed with their recorded duration; Repeat and
  Delete remain available. Their saved sets can still be corrected, including
  the effort report; rest, adding, removing, sorting and finishing belong to
  active sessions.

The active workout design also uses plan data the model does not store yet:
rep-range targets (for example 6–8), a rest length per exercise, a target
effort per exercise, and a planned weight distinct from the logged weight.

## Implemented entry points

The [route configuration](../../../app/routes.ts) includes:

| Route | Purpose |
| --- | --- |
| `/workouts` | Browse workouts |
| `/workouts/create` | Start an empty workout with one action |
| `/workouts/:id` | View a session's exercises, finish it, or reorder them |
| `/workouts/:id/exercises/:exerciseId` | Log or correct one exercise's sets |
| `/workouts/exercises` | Manage the exercise catalogue |
| `/workouts/:id/substitute/:exercise-id` | Substitute an exercise |

Session persistence and operations live in the
[workout session service](../../../app/modules/fitness/infra/workout-session.service.server.ts).
The [domain model](../../../app/modules/fitness/domain/workout.ts) owns workout
calculations and types; the [database schema](../../../app/db/schema.ts) owns
storage definitions.

## Retired entry points

Workout templates, Generate Workout, Strong and Fitbod import, AI Feedback, and
Recovery Map are retired. Their stored history remains intact; this removal does
not migrate or delete past sessions.
[Exercise substitution](adaptive-generation.md) remains available.

Coaches can create a current or past session through MCP and read history and
muscle volume. Future weekly planning is not implemented by this change; see
[MCP tools](../../mcp.md) for the current contract.

## Open domain questions

Muscle-group overlap does not make two exercises interchangeable. Comparing
progress between a fly and a press, or inferring a barbell load from a dumbbell
load, needs an explicit model rather than assuming matching muscle groups imply
equivalent performance. Keep these questions separate from recording actual sets.
