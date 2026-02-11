# AI Workout Generation

## Overview
AI Workout Generation replaces the current rule-based adaptive workout generator with an LLM-driven system. A "Generate with AI" button on the workout creation flow sends rich training context to Claude, which returns a complete workout (exercises, sets, reps, target weight). The user refines the workout through an inline chat conversation, then starts it.

This feature transforms the existing `/workouts/generate` page from a form-based equipment selector into an AI-powered generation and refinement experience.

## User Story
As the sole user of this app, I want an AI to generate my next workout based on my recent training history, fatigue state, and hypertrophy goals, so that I get intelligent progressive overload and exercise selection without manual programming.

## Core Problem
Manual workout programming requires deep knowledge of periodization, progressive overload, volume management, and recovery. The current adaptive workout generator uses static rules (movement pattern sequencing, equipment filtering, volume-based scoring) that cannot reason about trends, fatigue accumulation, or individual response patterns. An LLM can interpret training data holistically and apply training science principles contextually.

## User Profile
- Solo user (app owner)
- Primary goal: hypertrophy
- Flexible schedule (no fixed training days)
- Full gym access (no equipment constraints beyond what is in the database)
- Willing to log RPE per set

## Generation Context

The LLM receives a rich context payload assembled from the database before each generation. This is the core differentiator from the current rule-based system.

### Data Gathered
1. **Recent training data** (last 2-4 weeks per muscle group)
   - Exercises performed, sets, reps, weight
   - RPE per set (once the field is added)
   - Workout dates and durations
2. **Volume stats**
   - Weekly sets per muscle group vs. targets (from `VolumeTrackingRepository`)
   - Remaining volume needs for the current week
3. **e1RM trends per exercise**
   - Calculated from `ExerciseHistorySession.estimatedOneRepMax` (Epley formula, already implemented in `workout.ts`)
   - Trend direction over the last 2-4 weeks
4. **RPE data from recent sets**
   - Average RPE per exercise over recent sessions
   - RPE trend (increasing RPE at same weight = accumulating fatigue)
5. **Stored user preferences** (raw text from `training_preferences` table)
   - Equipment preferences, exercise likes/dislikes, scheduling notes
   - Accumulated from past refinement feedback
6. **Time constraint** (if specified by the user)

### Context Assembly
A new application service (`ai-workout-generation.service.server.ts`) queries the necessary repositories and assembles a structured context object. This object is serialized into the system prompt for Claude.

## Progressive Overload Logic

The LLM applies progressive overload principles within the system prompt. It does not use hard-coded rules.

### Hypertrophy Guidelines (encoded in system prompt)
- **Volume-first progression**: increase sets or reps before increasing weight
- **Rep range**: 6-15 reps for hypertrophy
- **RPE/RIR auto-regulation**: if recent RPE is consistently 9-10, suggest a lighter session or deload; if RPE is low (6-7), push harder
- **Weight increments**: small jumps (2.5kg barbell, 1-2kg dumbbell) when rep targets are consistently met

### Periodization (implicit, auto-detected)
- The AI infers mesocycle position from accumulated fatigue signals:
  - Rising RPE trend at constant or declining performance
  - Volume accumulation over multiple weeks
  - Performance stalls (e1RM plateau)
- The AI suggests deload weeks when these signals converge
- No explicit mesocycle tracking or creation is required

## Split and Exercise Selection

The AI decides which muscle groups to train for each session based on:
- **Recovery status**: days since last training per muscle group, volume done this week
- **Volume debt**: which muscle groups are behind on weekly targets
- **Exercise variation**: balancing consistency (keep main lifts) with variation (rotate accessories)
- **Stored preferences**: respect user-stated likes, dislikes, and constraints

The AI picks specific exercises from the exercise database (provided in context), including exercise type, movement pattern, and muscle group splits.

## UX Flow

### Happy Path
1. User navigates to workout creation (or taps "Generate with AI" from the workouts page)
2. Optionally sets a time constraint (e.g., "45 minutes")
3. Taps "Generate with AI"
4. Loading state while the LLM generates
5. AI returns a full workout displayed as a preview card:
   - Workout name
   - For each exercise: name, sets, target reps, target weight, rest period
   - Brief rationale for the session (e.g., "Push day focusing on chest volume debt")
6. Below the preview: inline chat input field
7. User types refinement feedback (e.g., "swap bench press for incline", "add more triceps work", "I only have 30 minutes")
8. AI adjusts the workout inline, updating the preview
9. Repeat until satisfied
10. User taps "Start workout" to create the workout and begin logging

### Interface Layout
```
+---------------------------------------------------+
| Generate Workout                                   |
+---------------------------------------------------+
| Time constraint (optional)  [45 min     v]         |
|                                                    |
| [Generate with AI]                                 |
+---------------------------------------------------+
|                                                    |
| Push Day - Chest & Triceps Focus                   |
| "Chest is behind on weekly volume. Targeting 8     |
|  sets pecs, 4 sets triceps. RPE trending 7-8,      |
|  pushing volume this session."                     |
|                                                    |
| 1. Incline Dumbbell Press                          |
|    4 x 10 @ 32kg  |  Rest: 2:00                   |
|                                                    |
| 2. Cable Fly                                       |
|    3 x 12 @ 15kg  |  Rest: 1:30                   |
|                                                    |
| 3. Dips                                            |
|    3 x 12 @ BW    |  Rest: 2:00                    |
|                                                    |
| 4. Overhead Triceps Extension (Cable)              |
|    3 x 15 @ 20kg  |  Rest: 1:30                   |
|                                                    |
| Est. duration: ~42 min                             |
|                                                    |
+---------------------------------------------------+
| Chat                                               |
| > Swap cable fly for pec deck, and add a drop set  |
|   on the last set of incline press                 |
|                                                    |
| AI: Updated. Swapped cable fly for pec deck at     |
| 45kg. Added a drop set note on incline press set 4.|
|                                                    |
| [Save "prefer pec deck over cable fly" as pref]    |
|                                                    |
| > [type feedback here...]                  [Send]  |
+---------------------------------------------------+
|                                                    |
| [Start Workout]                                    |
+---------------------------------------------------+
```

### Edge Cases
- **No training history**: AI generates a general hypertrophy workout with conservative weights, asks the user to confirm starting loads
- **API failure**: show error message, offer to retry or fall back to the existing rule-based generator
- **Long generation time**: show a skeleton/loading state with a progress indicator

## Memory System

### Training Preferences
User feedback during refinement conversations is optionally saved as raw text to inform future generations.

- Stored in a new `training_preferences` table
- On future generations, all stored preferences are included in the LLM context window
- No structured rule extraction: the LLM interprets raw text naturally
- Examples of stored preferences:
  - "I prefer cable exercises for chest isolation"
  - "Don't program behind-the-neck press, shoulder impingement"
  - "I like to start with a heavy compound and then do volume work"

### Conversation History
Each generation session's chat history is stored for reference but is NOT carried across sessions. Each new generation starts fresh with the full training context plus stored preferences.

## Data Model Changes

### 1. Add `rpe` to `workout_sets`
```sql
alter table workout_sets
  add column rpe double precision
  check (rpe is null or (rpe >= 6 and rpe <= 10));
```

In Drizzle (`app/db/schema.ts`), add to `workoutSets`:
```typescript
rpe: doublePrecision(),
```
With check constraint: `check("rpe_range", sql`${table.rpe} is null or (${table.rpe} >= 6 and ${table.rpe} <= 10)`)`.

Update the `WorkoutSet` domain interface in `app/modules/fitness/domain/workout.ts` to include `readonly rpe?: number`.

### 2. New table: `training_preferences`
```sql
create table training_preferences (
  id         uuid        primary key default gen_random_uuid(),
  content    text        not null,
  source     text        not null default 'refinement',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);
```

- `content`: raw text feedback from the user
- `source`: where the preference originated (`'refinement'` from chat, `'manual'` from a settings page)

### 3. New table: `generation_conversations`
```sql
create table generation_conversations (
  id               uuid        primary key default gen_random_uuid(),
  workout_id       uuid        references workouts (id),
  messages         jsonb       not null default '[]',
  context_snapshot jsonb       not null,
  model            text        not null,
  total_tokens     integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz,
  deleted_at       timestamptz
);
```

- `workout_id`: nullable, linked once the user starts the workout (may be null if abandoned)
- `messages`: JSON array of `{ role: "user" | "assistant", content: string }` entries
- `context_snapshot`: the assembled training context sent for this session (for debugging/auditing)
- `model`: the Claude model used (e.g., `"claude-4-opus-20250514"`)
- `total_tokens`: cumulative token usage for the conversation

## Technical Approach

### LLM Integration
- **SDK**: Anthropic SDK (already in use via `ai-fitness-coach.service.ts`)
- **Model**: Claude (same model as existing AI fitness coach)
- **Structured output**: use tool-use / function calling to enforce a JSON schema for the workout response
- **System prompt**: rich prompt encoding training science principles, the user's training context, and stored preferences

### Workout Response Schema (tool output)
```typescript
interface GeneratedWorkout {
  readonly name: string;
  readonly rationale: string;
  readonly estimatedDuration: number;
  readonly exercises: ReadonlyArray<{
    readonly exerciseId: string;
    readonly exerciseName: string;
    readonly sets: ReadonlyArray<{
      readonly setNumber: number;
      readonly targetReps: number;
      readonly targetWeight: number;
      readonly isWarmup: boolean;
      readonly restSeconds: number;
    }>;
    readonly notes?: string;
  }>;
  readonly sessionNotes?: string;
}
```

### Conversation State
- The refinement loop maintains conversation state server-side in `generation_conversations`
- Each user message triggers a new API call with the full conversation history
- The AI returns an updated workout using the same structured output schema
- The frontend replaces the preview with the updated workout on each refinement

### Architecture (module structure)
```
app/modules/fitness/
  domain/
    workout.ts                          # Updated: add rpe to WorkoutSet
    ai-generation.ts                    # New: domain types for generation
  application/
    ai-workout-generation.service.server.ts  # New: orchestrates context assembly + LLM calls
  infra/
    ai-workout-generation.repository.server.ts  # New: DB queries for context, preferences, conversations
    ai-fitness-coach.service.ts                 # Existing: can share Anthropic client setup
  presentation/
    components/
      WorkoutPreview/                   # New: displays generated workout for review
      RefinementChat/                   # New: inline chat input and message history
```

### Route Changes
The existing `workouts/generate` route will be reworked:
- **Loader**: fetches training context summary (volume stats, recent workout count) for the initial UI
- **Action**: handles multiple intents:
  - `generate`: sends initial generation request
  - `refine`: sends a refinement message with conversation ID
  - `start`: creates the workout from the generated plan
  - `save-preference`: persists a refinement message as a training preference

## Integration Points

### Existing Infrastructure Used
- `VolumeTrackingRepository` for weekly volume stats and needs
- `ExerciseMuscleGroupsRepository` for exercise database with muscle group splits
- `WorkoutRepository` and `WorkoutSession` domain entity for saving the final workout
- Anthropic SDK client pattern from `ai-fitness-coach.service.ts`
- `ExerciseHistorySession.estimatedOneRepMax` for e1RM calculations (Epley formula)
- `DEFAULT_VOLUME_TARGETS` from `workout.ts` for weekly set targets per muscle group

### Existing Infrastructure Replaced
- `AdaptiveWorkoutService.generateWorkout()` is superseded by the AI generation for the generate page
- `AdaptiveWorkoutRepository` equipment queries remain useful for context but are no longer the core generation logic
- The existing rule-based generator can remain as a fallback

## Acceptance Criteria

### Generation
- [ ] User can generate a workout with one tap from the generate page
- [ ] Generated workout includes exercises, sets, reps, target weight, and rest periods
- [ ] Generation uses last 2-4 weeks of training data as context
- [ ] Generation respects stored training preferences
- [ ] Time constraint is respected when specified
- [ ] A brief rationale explains the workout structure

### Refinement
- [ ] User can type feedback in an inline chat below the workout preview
- [ ] AI updates the workout based on feedback
- [ ] Multiple rounds of refinement are supported
- [ ] Conversation history is maintained within the session
- [ ] User can save a refinement message as a training preference for future sessions

### Workout Start
- [ ] "Start workout" creates the workout and all exercises/sets in the database
- [ ] User is redirected to the active workout page (`/workouts/:id`)
- [ ] Conversation is linked to the created workout

### RPE Logging
- [ ] RPE field (optional, 6.0-10.0) is available on each set during workout logging
- [ ] RPE data is persisted and available for future generation context

### Error Handling
- [ ] API failures show a clear error message
- [ ] User can retry generation after failure
- [ ] Fallback to rule-based generation is offered if AI is unavailable

## Implementation Phases

### Phase 1: Data Model and RPE
- Add `rpe` column to `workout_sets`
- Update domain types (`WorkoutSet` interface)
- Add RPE input to the workout logging UI (set row)
- Create `training_preferences` and `generation_conversations` tables

### Phase 2: Context Assembly
- Build the context assembly service that queries training history, volume stats, e1RM trends, and RPE data
- Create the training preferences repository (CRUD)
- Serialize context into a structured prompt

### Phase 3: AI Generation
- Implement the generation service with Claude API integration
- Define the structured output schema (tool use)
- Build the system prompt with training science principles
- Rework the `/workouts/generate` route and UI

### Phase 4: Refinement Loop
- Implement conversation state management
- Build the inline chat UI component
- Support multi-turn refinement with workout preview updates
- Add "save as preference" action for refinement messages

### Phase 5: Workout Creation from Generation
- Convert the generated workout into domain entities
- Save workout, exercises, and sets via existing repositories
- Link conversation to created workout
- Redirect to active workout page

## Open Questions
1. **Token budget**: should there be a cap on refinement turns per session to control API costs?
2. **Exercise ID resolution**: should the AI pick exercises by ID (requires exercise list in context) or by name (requires fuzzy matching)?
   - Recommendation: provide exercise list with IDs in context, AI returns IDs.
3. **Weight unit**: the current schema stores weight as a double without explicit unit. Should we formalize kg as the unit?
4. **Deload detection threshold**: what RPE trend slope or duration should trigger the AI to suggest a deload? This is left to the LLM's judgment for now but could be tuned.

## Future Enhancements
- **Voice-based refinement**: speak feedback instead of typing
- **Post-workout learning**: after completing a generated workout, automatically capture RPE-based feedback to improve future generations
- **Multi-session planning**: generate a week of workouts at once, respecting recovery across sessions
- **Preference management UI**: a settings page to view, edit, and delete stored training preferences
