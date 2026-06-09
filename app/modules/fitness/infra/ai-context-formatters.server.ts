import type {
  ExerciseCatalogEntry,
  ExerciseProgression,
  WorkoutSummary,
} from "../domain/ai-generation";

export function formatRecentWorkouts(
  workouts: ReadonlyArray<WorkoutSummary>,
): string {
  if (workouts.length === 0) return "No recent workouts found.";

  return workouts
    .map((w) => {
      const duration = w.durationMinutes ? ` (${w.durationMinutes} min)` : "";
      const exerciseLines = w.exercises
        .map((e) => {
          const setDetails = e.sets
            .filter((s) => !s.isWarmup)
            .map((s) => {
              const rpe = s.rpe ? ` @RPE${s.rpe}` : "";
              return `${s.reps ?? "?"}×${s.weight ?? "?"}kg${rpe}`;
            })
            .join(", ");
          return `  - ${e.name} [${e.muscleGroups.join(", ")}]: ${setDetails}`;
        })
        .join("\n");
      return `### ${w.date} - ${w.name}${duration}\n${exerciseLines}`;
    })
    .join("\n\n");
}

export function formatProgressions(
  progressions: ReadonlyArray<ExerciseProgression>,
): string {
  if (progressions.length === 0) return "No progression data available.";

  return progressions
    .map((p) => {
      const latest = p.recentSessions[p.recentSessions.length - 1];
      if (!latest) return `- **${p.exerciseName}**: no data`;
      const rpe = latest.avgRpe ? ` @RPE${latest.avgRpe.toFixed(1)}` : "";
      return `- **${p.exerciseName}**: e1RM ${latest.estimatedOneRepMax.toFixed(1)}kg (trend: ${p.trend})${rpe}`;
    })
    .join("\n");
}

export function formatExerciseCatalog(
  exercises: ReadonlyArray<ExerciseCatalogEntry>,
): string {
  const byPattern = new Map<string, ExerciseCatalogEntry[]>();
  for (const e of exercises) {
    const group = byPattern.get(e.movementPattern) ?? [];
    group.push(e);
    byPattern.set(e.movementPattern, group);
  }

  return Array.from(byPattern.entries())
    .map(([pattern, entries]) => {
      const lines = entries
        .map((e) => {
          const muscles = e.muscleGroups
            .map((m) => `${m.name}:${m.split}%`)
            .join(", ");
          return `- [${e.id}] ${e.name} (${e.type}) → ${muscles}`;
        })
        .join("\n");
      return `### ${pattern}\n${lines}`;
    })
    .join("\n\n");
}
