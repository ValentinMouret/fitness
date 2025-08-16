import { redirect } from "react-router";
import type { Route } from "./+types/import";
import {
  Container,
  Heading,
  Flex,
  Button,
  Link as RadixLink,
} from "@radix-ui/themes";
import { Link } from "react-router";
import { StrongImportForm } from "~/modules/fitness/presentation/components";
import {
  importWorkout,
  validateStrongText,
} from "~/modules/fitness/application/strong-import.service.server";
import type { ImportConfig } from "~/modules/fitness/domain/strong-import";

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const strongText = formData.get("strongText") as string;
  const createMissingExercises =
    formData.get("createMissingExercises") === "true";
  const skipUnmappedExercises =
    formData.get("skipUnmappedExercises") === "true";
  const customImportTime = formData.get("customImportTime") as string;

  if (!strongText?.trim()) {
    return {
      success: false,
      error: "Strong export text is required",
    };
  }

  const validationResult = validateStrongText(strongText);
  if (validationResult.isErr()) {
    return {
      success: false,
      error: validationResult.error,
    };
  }

  const config: ImportConfig = {
    createMissingExercises,
    skipUnmappedExercises,
    overrideImportTime: customImportTime
      ? new Date(customImportTime)
      : undefined,
  };

  const importResult = await importWorkout(strongText, config);

  if (importResult.isErr()) {
    console.error("Strong import failed:", importResult.error);

    // Provide user-friendly error messages
    let errorMessage = "Import failed. Please check your Strong export format.";
    switch (importResult.error) {
      case "invalid_strong_format":
        errorMessage =
          "The text doesn't appear to be a valid Strong export. Please copy the complete workout export from Strong.";
        break;
      case "invalid_date_format":
        errorMessage =
          "Could not parse the workout date. Please ensure the export includes the complete date and time.";
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
    };
  }

  const result = importResult.value;

  if (result.unmappedExercises.length > 0 && !skipUnmappedExercises) {
    return {
      success: false,
      error: "Some exercises need manual mapping",
      unmappedExercises: result.unmappedExercises,
    };
  }

  if (result.unmappedExercises.length === 0) {
    return redirect(`/workouts/${result.workoutId}`);
  }

  return {
    success: true,
    result,
  };
};

export default function WorkoutImportPage() {
  const handleImportSuccess = (result: unknown) => {
    // This will be called by the form component on successful import
    // The form will handle navigation or display success message
  };

  return (
    <Container>
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
          <Heading size="8">Import from Strong</Heading>
          <RadixLink asChild>
            <Link to="/workouts">
              <Button variant="ghost">Back to Workouts</Button>
            </Link>
          </RadixLink>
        </Flex>

        <StrongImportForm onImportSuccess={handleImportSuccess} />
      </Flex>
    </Container>
  );
}
