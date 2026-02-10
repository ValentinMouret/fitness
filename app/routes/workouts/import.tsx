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
import { zfd } from "zod-form-data";
import {
  importFromFitbod,
  importFromStrong,
} from "~/modules/fitness/application/import-workout.service.server";
import type { ImportConfig } from "~/modules/fitness/domain/strong-import";
import {
  FitbodImportForm,
  StrongImportForm,
} from "~/modules/fitness/presentation/components";
import { formBoolean, formOptionalText } from "~/utils/form-data";
import type { Route } from "./+types/import";

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const schema = zfd.formData({
    importSource: formOptionalText(),
    createMissingExercises: formBoolean(),
    skipUnmappedExercises: formBoolean(),
    customImportTime: formOptionalText(),
    strongText: formOptionalText(),
    csvContent: formOptionalText(),
  });
  const parsed = schema.parse(formData);
  const importSource = parsed.importSource ?? "strong";

  const config: ImportConfig = {
    createMissingExercises: parsed.createMissingExercises,
    skipUnmappedExercises: parsed.skipUnmappedExercises,
    overrideImportTime: parsed.customImportTime
      ? new Date(parsed.customImportTime)
      : undefined,
  };

  if (importSource === "fitbod") {
    return importFromFitbod({
      csvContent: parsed.csvContent ?? "",
      config,
      skipUnmappedExercises: parsed.skipUnmappedExercises,
    });
  }

  return importFromStrong({
    strongText: parsed.strongText ?? "",
    config,
    skipUnmappedExercises: parsed.skipUnmappedExercises,
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
