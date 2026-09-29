# Equipment and exercise substitution

The workout session supports replacing an exercise using available equipment.
This flow uses the adaptive repository and the substitution methods of the
adaptive service. The retained rule-based generation methods have no UI entry
point and are not an accepted fallback workout generator.

Substitute comparison still uses a random placeholder; it is not a reliable
similarity ranking. Muscle-group overlap alone does not make two exercises
interchangeable or their loads comparable.

## Implementation references

- [Adaptive service](../../../app/modules/fitness/infra/adaptive-workout-service.server.ts)
- [Equipment and substitution repository](../../../app/modules/fitness/infra/adaptive-workout-repository.server.ts)
- [Substitution service](../../../app/modules/fitness/infra/substitute-exercise.service.server.ts)
- [Substitution route](../../../app/routes/workouts/:id/substitute/:exercise-id.tsx)
