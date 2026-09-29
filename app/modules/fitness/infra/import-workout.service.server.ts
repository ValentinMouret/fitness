import { redirect } from "react-router";
import type { ImportConfig } from "~/modules/fitness/domain/fitbod-import";
import {
  importFitbodCSV,
  validateFitbodCSV,
} from "~/modules/fitness/infra/fitbod-import.service.server";
export async function importFromFitbod(input: {
  readonly csvContent: string;
  readonly config: ImportConfig;
  readonly skipUnmappedExercises: boolean;
}) {
  if (!input.csvContent.trim()) {
    return {
      success: false,
      error: "CSV content is required",
    } as const;
  }

  const validationResult = validateFitbodCSV(input.csvContent);
  if (validationResult.isErr()) {
    return {
      success: false,
      error: validationResult.error,
    } as const;
  }

  const importResult = await importFitbodCSV(input.csvContent, input.config);

  if (importResult.isErr()) {
    let errorMessage = "Import failed. Please check your Fitbod CSV format.";
    switch (importResult.error) {
      case "invalid_csv_format":
        errorMessage =
          "The file doesn't appear to be a valid Fitbod CSV. Please ensure you've exported from Fitbod.";
        break;
      case "no_workouts_found":
        errorMessage =
          "No valid workouts found in the CSV. Cardio-only exercises are skipped.";
        break;
      case "exercise_mapping_failed":
        errorMessage =
          "Some exercises could not be mapped. Try enabling 'Create missing exercises' or 'Skip unmapped exercises'.";
        break;
      case "workout_save_failed":
        errorMessage = "Failed to save the workout. Please try again.";
        break;
      case "database_error":
        errorMessage = "Database error occurred. Please try again.";
        break;
    }

    return {
      success: false,
      error: errorMessage,
    } as const;
  }

  const result = importResult.value;

  if (result.unmappedExercises.length > 0 && !input.skipUnmappedExercises) {
    return {
      success: false,
      error: "Some exercises need manual mapping",
      unmappedExercises: result.unmappedExercises,
    } as const;
  }

  if (result.unmappedExercises.length === 0) {
    return redirect(`/workouts/${result.workoutId}`);
  }

  return {
    success: true,
    result,
  } as const;
}
