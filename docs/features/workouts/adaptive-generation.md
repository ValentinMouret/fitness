# Adaptive workout generation

Status: Retained rule-based implementation. The generation page now uses
[AI generation](ai-generation.md); it does not expose this generator as a fallback.
This document describes repository code, not a supported alternative UI flow.

## Purpose and model

The adaptive generator selects exercises using available equipment, session
duration, movement patterns, and optional weekly muscle-group volume needs.
Equipment instances identify a type and gym floor. The result contains a workout,
exercise alternatives, estimated duration, and a count of floor switches.

The service filters by available equipment types, sequences movement patterns,
and scores exercises by volume priority and hard-coded equipment preferences.
Duration is estimated from exercise count. It requires at least three exercises.

## Current limits

The earlier design described caching, database-backed preference scoring, and
strict volume/performance success targets. Those statements were design intent,
not established guarantees, and should not guide new implementation work.

In the current service:

- Equipment preferences are hard-coded rather than loaded from preference tables.
- Duration and floor switches are estimates, not optimisation guarantees.
- Substitute comparison uses a random placeholder, not a reliable similarity ranking.

Decide whether to maintain and expose this path before expanding it. Keeping a
service in the repository does not make it an accepted fallback product requirement.

## Implementation references

- [Adaptive service](../../../app/modules/fitness/infra/adaptive-workout-service.server.ts)
- [Equipment and substitution repository](../../../app/modules/fitness/infra/adaptive-workout-repository.server.ts)
- [Older generation orchestration](../../../app/modules/fitness/infra/generate-workout.service.server.ts)
- [Current generation route](../../../app/routes/workouts/generate.tsx)
- [Substitution route](../../../app/routes/workouts/:id/substitute/:exercise-id.tsx)
