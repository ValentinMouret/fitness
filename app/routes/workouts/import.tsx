import { Container } from "@radix-ui/themes";
import { data } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import type { ImportConfig } from "~/modules/fitness/domain/fitbod-import";
import { importFromFitbod } from "~/modules/fitness/infra/import-workout.service.server";
import { FitbodImportForm } from "~/modules/fitness/presentation/components";
import { formBoolean, formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/import";

export const handle = {
  header: () => ({
    title: "Import from Fitbod",
    backTo: "/workouts",
  }),
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const schema = zfd.formData({
    importSource: formText(z.literal("fitbod")),
    createMissingExercises: formBoolean(),
    skipUnmappedExercises: formBoolean(),
    customImportTime: formOptionalText(),
    csvContent: formOptionalText(),
  });
  const result = schema.safeParse(formData);
  if (!result.success)
    return data(
      { success: false, error: "Provide a Fitbod CSV import" },
      { status: 400 },
    );
  const parsed = result.data;

  const config: ImportConfig = {
    createMissingExercises: parsed.createMissingExercises,
    skipUnmappedExercises: parsed.skipUnmappedExercises,
    overrideImportTime: parsed.customImportTime
      ? new Date(parsed.customImportTime)
      : undefined,
  };

  return importFromFitbod({
    csvContent: parsed.csvContent ?? "",
    config,
    skipUnmappedExercises: parsed.skipUnmappedExercises,
  });
};

export default function WorkoutImportPage() {
  const handleImportSuccess = (_result: unknown) => {};

  return (
    <Container>
      <FitbodImportForm onImportSuccess={handleImportSuccess} />
    </Container>
  );
}
