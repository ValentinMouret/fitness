# Adaptive Workout Generator - Architecture

## Overview
The adaptive workout generator extends our existing fitness module to provide intelligent, equipment-aware workout generation following evidence-based training principles.

## Domain Model

### Core Entities

#### AdaptiveWorkoutGenerator
Orchestrates workout generation based on equipment availability and volume needs.

```typescript
interface AdaptiveWorkoutRequest {
  readonly availableEquipment: ReadonlyArray<EquipmentInstance>;
  readonly targetDuration: number;
  readonly preferredFloor?: number;
}

interface AdaptiveWorkoutResult {
  readonly workout: WorkoutSession;
  readonly alternatives: ReadonlyMap<Exercise["id"], ReadonlyArray<Exercise>>;
  readonly floorSwitches: number;
  readonly estimatedDuration: number;
}
```

#### WeeklyVolumeTracker
Tracks weekly training volume by muscle group to maintain hypertrophy targets.

```typescript
interface VolumeTarget {
  readonly muscleGroup: MuscleGroup;
  readonly minSets: number;
  readonly maxSets: number;
}

interface WeeklyVolumeTracker {
  readonly weekStart: Date;
  readonly targets: ReadonlyArray<VolumeTarget>;
  readonly currentVolume: ReadonlyMap<MuscleGroup, number>;
  readonly remainingVolume: ReadonlyMap<MuscleGroup, number>;
}
```

#### MovementPatternSequencer
Enforces optimal exercise sequencing: PUSH → PULL → SQUAT → CORE → HINGE → ISOLATION

```typescript
const OPTIMAL_SEQUENCE: ReadonlyArray<MovementPattern> = [
  "push", "pull", "squat", "core", "hinge", "isolation"
] as const;

interface SequenceRecommendation {
  readonly nextPattern: MovementPattern;
  readonly confidence: number;
  readonly reasoning: string;
}
```

## Application Services

### AdaptiveWorkoutService
```typescript
class AdaptiveWorkoutService {
  generateWorkout(request: AdaptiveWorkoutRequest): Result<AdaptiveWorkoutResult, WorkoutGenerationError>
  replaceExercise(workoutId: string, exerciseId: string, equipment: ReadonlyArray<EquipmentInstance>): Result<Exercise, SubstitutionError>
}
```

### VolumeTrackingService
```typescript
class VolumeTrackingService {
  getCurrentWeekVolume(): Result<WeeklyVolumeTracker, VolumeTrackingError>
  updateVolume(workout: WorkoutSession): Result<WeeklyVolumeTracker, VolumeTrackingError>
  getVolumeNeeds(): Result<ReadonlyMap<MuscleGroup, number>, VolumeTrackingError>
}
```

## Database Schema Extensions

### Existing Tables (Already Present)
- `gym_floors` - Floor-based equipment layout
- `equipment_instances` - Specific equipment with availability status
- `equipment_preferences` - Preference scoring by muscle group and equipment type
- `exercise_substitutions` - Exercise substitution matrix with similarity scoring

### Volume Targets (Default Configuration)
- Chest: 12-16 sets/week
- Back: 14-18 sets/week  
- Shoulders: 12-16 sets/week
- Arms: 8-12 sets each/week
- Legs: 12-16 sets each/week
- Core: 6-10 sets/week

## Route Integration

### New Routes
- `/workouts/generate` - Equipment selection and workout generation
- `/workouts/:id/substitute/:exerciseId` - Mid-workout exercise substitution

### Enhanced Routes
- `/workouts/:id` - Add substitution UI components to existing workout view

### Workout Generation Flow
1. User selects available equipment on `/workouts/generate`
2. System generates `AdaptiveWorkoutResult` with `WorkoutSession`
3. Action saves the workout as standard `Workout` entity to database
4. Action saves workout exercises to `workout_exercises` table
5. **Redirects to `/workouts/:id`** - standard workout tracking view
6. User can start workout normally with substitution options available

## Performance Strategy

### Simple Caching
- In-memory exercise substitution cache
- Equipment preference cache by muscle group
- Pre-load on application startup

### Database Optimization  
- Single transaction for workout generation data
- Indexes on substitution and preference queries

## Exercise Selection Logic

### Substitution Criteria
- `similarity_score` > 0.7 (primary factor)
- `muscle_overlap_percentage` > 80%
- `difficulty_difference` within ±2 range

### Equipment Preference Ordering
- Numerical scoring in `equipment_preferences` table
- Higher scores = higher preference
- Different scoring for legs vs other muscle groups allowed

## Integration Points

### Component Enhancements
- `WorkoutExerciseCard` - Add "..." menu with "Replace" option
- `EquipmentSelector` - Quick gym-friendly equipment availability input

### State Management
- Session-scoped equipment availability (not persistent across sessions)
- Real-time substitution using `useFetcher` for non-navigating updates

## Success Criteria
- Workout generation < 3 seconds on mobile
- Weekly volume targets maintained within 5% variance  
- 90%+ adherence to optimal movement pattern sequence
- Seamless integration with existing workout tracking system