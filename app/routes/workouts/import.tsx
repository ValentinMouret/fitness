import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link as RadixLink,
  Tabs,
} from "@radix-ui/themes";
import { Link } from "react-router";
import type { ImportConfig } from "~/modules/fitness/domain/strong-import";
import {
  FitbodImportForm,
  StrongImportForm,
} from "~/modules/fitness/presentation/components";
import type { Route } from "./+types/import";
import {
  importFromFitbod,
  importFromStrong,
} from "~/modules/fitness/application/import-workout.service.server";

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const importSourceValue = formData.get("importSource");
  const importSource =
    typeof importSourceValue === "string" ? importSourceValue : "";

  const createMissingExercises =
    formData.get("createMissingExercises") === "true";
  const skipUnmappedExercises =
    formData.get("skipUnmappedExercises") === "true";
  const customImportTimeValue = formData.get("customImportTime");
  const customImportTime =
    typeof customImportTimeValue === "string" ? customImportTimeValue : "";

  const config: ImportConfig = {
    createMissingExercises,
    skipUnmappedExercises,
    overrideImportTime: customImportTime
      ? new Date(customImportTime)
      : undefined,
  };

  if (importSource === "fitbod") {
    const csvContentValue = formData.get("csvContent");
    const csvContent =
      typeof csvContentValue === "string" ? csvContentValue : "";
    return importFromFitbod({
      csvContent,
      config,
      skipUnmappedExercises,
    });
  }

  const strongTextValue = formData.get("strongText");
  const strongText = typeof strongTextValue === "string" ? strongTextValue : "";
  return importFromStrong({
    strongText,
    config,
    skipUnmappedExercises,
  });
};

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
