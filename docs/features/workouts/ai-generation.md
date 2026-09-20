# AI workout generation

Status: Implemented flow, with limitations below. Verified by code inspection,
not by a live AI or browser acceptance run.

The owner can generate a hypertrophy workout from training history, refine it in
chat, and start logging it. This is the current `/workouts/generate` flow; the
[adaptive generator](adaptive-generation.md) is not exposed there as a fallback.

## User flow

1. Optionally provide a time constraint.
2. Generate a workout with exercises, sets, target reps and weights, rest periods,
   estimated duration, and a rationale.
3. Refine the preview through chat, for example by requesting an exercise swap.
4. Optionally save feedback as a preference for future generation.
5. Start the workout and navigate to its session page.

Generation and refinement failures return an error to the page. The route has
`generate`, `refine`, `save-preference`, and `start` actions; it has no rule-based
fallback action.

## Training context

The generation service assembles:

- Recent workouts and exercise progressions from the last four weeks.
- Completed-set data, including available RPE values.
- Weekly muscle-group volume against targets.
- An exercise catalogue with IDs, equipment types, movement patterns, and
  muscle-group contributions.
- Stored free-text training preferences.
- The optional session time constraint.

The estimated one-repetition maximum (e1RM) trend is used as a progression signal.
The prompt asks the model to consider recovery, volume needs, recent performance,
warm-ups, and rest. These are model instructions, not guarantees enforced by a
training optimiser. The service is the source of truth for the current prompt;
do not duplicate its thresholds in this document.

## Preferences and conversation history

Preferences are stored as text, not extracted into structured training rules.
They are included in future generation contexts. Conversations persist their
messages, context snapshot, model, and token usage. Refinement reuses the stored
context and conversation; a new generation starts a new conversation.

RPE is optional and constrained to 6–10 in the database. Missing RPE is not a
reported low-effort set.

## Starting a workout

The creation service checks generated exercise IDs against the catalogue,
skips unknown exercises, and rejects a plan with no valid exercises. It saves
the workout, exercise ordering, and sets in one transaction. Conversation linking
happens afterwards and is non-critical.

The current persistence path saves target reps, weight, and warm-up flags, but
not the generated per-set rest periods or overall session notes. It normalises
non-positive target values to null where database constraints require positive
values. The preview and the saved session therefore do not preserve every field
of the generated response.

## Implementation references

- [Route and actions](../../../app/routes/workouts/generate.tsx)
- [Generation domain types](../../../app/modules/fitness/domain/ai-generation.ts)
- [Context, prompt, and API service](../../../app/modules/fitness/infra/ai-workout-generation.service.server.ts)
- [Conversation and preference persistence](../../../app/modules/fitness/infra/ai-workout-generation.repository.server.ts)
- [Workout creation](../../../app/modules/fitness/infra/create-workout-from-generation.service.server.ts)

External API and repository composition lives in infrastructure. Follow the
[architecture guide](../../engineering/architecture.md), not the older proposal's
application-layer repository imports.

## Proposed extensions

Status: Draft; not committed requirements.

- Offer a deliberate non-AI fallback when generation fails.
- Manage saved preferences outside a refinement conversation.
- Refine by voice or plan multiple sessions together.
- Capture post-workout feedback for future generation.

Before extending the flow, decide whether refinement needs a token/turn budget,
how much prescription detail must survive workout creation, and which training
constraints must be validated independently of the model.
