import { Badge, Heading, Text } from "@radix-ui/themes";
import type { GeneratedWorkout } from "~/modules/fitness/domain/ai-generation";
import "./WorkoutPreview.css";

interface WorkoutPreviewProps {
  readonly workout: GeneratedWorkout;
}

export function WorkoutPreview({ workout }: WorkoutPreviewProps) {
  return (
    <div className="workout-preview">
      <div className="workout-preview__header">
        <Heading size="4">{workout.name}</Heading>
      </div>

      <div className="workout-preview__rationale">
        <Text size="2">{workout.rationale}</Text>
      </div>

      <div className="workout-preview__exercises">
        {workout.exercises.map((exercise, index) => (
          <div key={exercise.exerciseId} className="workout-preview__exercise">
            <div className="workout-preview__exercise-header">
              <Text size="2" weight="medium">
                {index + 1}. {exercise.exerciseName}
              </Text>
            </div>

            <table className="workout-preview__set-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reps</th>
                  <th>Weight</th>
                  <th>Rest</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                  <tr
                    key={set.setNumber}
                    className={
                      set.isWarmup ? "workout-preview__set-row--warmup" : ""
                    }
                  >
                    <td>
                      {set.setNumber}
                      {set.isWarmup && (
                        <Badge size="1" color="gray" ml="1">
                          W
                        </Badge>
                      )}
                    </td>
                    <td>{set.targetReps}</td>
                    <td>{set.targetWeight}kg</td>
                    <td>{formatRest(set.restSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {exercise.notes && (
              <div className="workout-preview__exercise-notes">
                {exercise.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="workout-preview__footer">
        <Text size="2">Est. duration: ~{workout.estimatedDuration} min</Text>
        <Text size="2">
          {workout.exercises.length} exercises,{" "}
          {workout.exercises.reduce(
            (sum, e) => sum + e.sets.filter((s) => !s.isWarmup).length,
            0,
          )}{" "}
          working sets
        </Text>
      </div>

      {workout.sessionNotes && (
        <div className="workout-preview__session-notes">
          <Text size="2">{workout.sessionNotes}</Text>
        </div>
      )}
    </div>
  );
}

function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}:00`;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
