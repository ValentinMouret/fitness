import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link as RadixLink,
  Tabs,
} from "@radix-ui/themes";
import { Link, redirect } from "react-router";
import {
  importFitbodCSV,
  validateFitbodCSV,
} from "~/modules/fitness/application/fitbod-import.service.server";
import {
  importWorkout,
  validateStrongText,
} from "~/modules/fitness/application/strong-import.service.server";
import type { ImportConfig } from "~/modules/fitness/domain/strong-import";
import {
  FitbodImportForm,
  StrongImportForm,
} from "~/modules/fitness/presentation/components";
import type { Route } from "./+types/import";

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const importSource = formData.get("importSource") as string;

  const createMissingExercises =
    formData.get("createMissingExercises") === "true";
  const skipUnmappedExercises =
    formData.get("skipUnmappedExercises") === "true";
  const customImportTime = formData.get("customImportTime") as string;

  const config: ImportConfig = {
    createMissingExercises,
    skipUnmappedExercises,
    overrideImportTime: customImportTime
      ? new Date(customImportTime)
      : undefined,
  };

  if (importSource === "fitbod") {
    return handleFitbodImport(formData, config, skipUnmappedExercises);
  }

  return handleStrongImport(formData, config, skipUnmappedExercises);
};

async function handleStrongImport(
  formData: FormData,
  config: ImportConfig,
  skipUnmappedExercises: boolean,
) {
  const strongText = formData.get("strongText") as string;

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

  const importResult = await importWorkout(strongText, config);

  if (importResult.isErr()) {
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
}

async function handleFitbodImport(
  formData: FormData,
  config: ImportConfig,
  skipUnmappedExercises: boolean,
) {
  const csvContent = formData.get("csvContent") as string;

  if (!csvContent?.trim()) {
    return {
      success: false,
      error: "CSV content is required",
    };
  }

  const validationResult = validateFitbodCSV(csvContent);
  if (validationResult.isErr()) {
    return {
      success: false,
      error: validationResult.error,
    };
  }

  const importResult = await importFitbodCSV(csvContent, config);

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
}

export default function WorkoutImportPage() {
  const handleImportSuccess = (_result: unknown) => {};

  return (
    <Container>
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
          <Heading size="8">Import Workout</Heading>
          <RadixLink asChild>
            <Link to="/workouts">
              <Button variant="ghost">Back to Workouts</Button>
            </Link>
          </RadixLink>
        </Flex>

        <Tabs.Root defaultValue="strong">
          <Tabs.List>
            <Tabs.Trigger value="strong">Strong</Tabs.Trigger>
            <Tabs.Trigger value="fitbod">Fitbod</Tabs.Trigger>
          </Tabs.List>
          <Box pt="4">
            <Tabs.Content value="strong">
              <StrongImportForm onImportSuccess={handleImportSuccess} />
            </Tabs.Content>
            <Tabs.Content value="fitbod">
              <FitbodImportForm onImportSuccess={handleImportSuccess} />
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Flex>
    </Container>
  );
}
