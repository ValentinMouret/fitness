import { Button, Callout, Text } from "@radix-ui/themes";
import { data, Link, redirect } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import ExerciseForm from "~/components/ExerciseForm";
import { logger } from "~/logger.server";
import {
  ExerciseMuscleGroupsAggregate,
  exerciseTypes,
  movementPatterns,
  muscleGroups,
} from "~/modules/fitness/domain/workout";
import {
  getExerciseForEdit,
  type MuscleGroupSplitInput,
  updateExercise,
} from "~/modules/fitness/infra/exercise-form.service.server";
import { parseExerciseReturnTo } from "~/modules/fitness/presentation/exercise-editor-navigation";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/edit";

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const exerciseId = params["exercise-id"];

  const exercise = await getExerciseForEdit(exerciseId);
  const query = z
    .object({ returnTo: z.string().nullable() })
    .parse({ returnTo: new URL(request.url).searchParams.get("returnTo") });
  return { exercise, returnTo: parseExerciseReturnTo(query.returnTo) };
};

export const handle = {
  header: (data: Route.ComponentProps["loaderData"]) => ({
    title: `Edit ${data?.exercise?.exercise?.name || "Exercise"}`,
    backTo: data.returnTo,
  }),
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const exerciseId = params["exercise-id"];

  const form = await request.formData();
  const schema = zfd.formData({
    name: formText(z.string().min(1)),
    type: formText(z.enum(exerciseTypes)),
    movementPattern: formText(z.enum(movementPatterns)),
    description: formOptionalText(),
    mmcInstructions: formOptionalText(),
  });
  const parsed = schema.safeParse(form);
  if (!parsed.success)
    return data(
      { error: "Check the exercise name, equipment and movement pattern." },
      { status: 400 },
    );

  const muscleGroupSplits: MuscleGroupSplitInput[] = [];
  let i = 0;
  while (true) {
    const muscleGroupString = form.get(`${i}-muscle-group`)?.toString();
    const splitString = form.get(`${i}-split`)?.toString();

    if (muscleGroupString === undefined) break;
    muscleGroupSplits.push({
      muscleGroup: muscleGroupString,
      split: splitString ?? "",
    });

    i++;
  }

  const splits = z
    .array(
      z.object({
        muscleGroup: z.enum(muscleGroups),
        split: z.coerce.number().positive().max(100),
      }),
    )
    .safeParse(muscleGroupSplits);
  if (!splits.success)
    return data(
      { error: "Check the muscle groups and percentages." },
      { status: 400 },
    );
  try {
    const current = await getExerciseForEdit(exerciseId ?? "");
    if (
      ExerciseMuscleGroupsAggregate.create(
        current.exercise,
        splits.data,
        false,
      ).isErr()
    ) {
      return data(
        { error: "Muscle percentages must total 100." },
        { status: 400 },
      );
    }
    await updateExercise({
      id: exerciseId ?? "",
      name: parsed.data.name,
      type: parsed.data.type,
      movementPattern: parsed.data.movementPattern,
      description: parsed.data.description ?? undefined,
      mmcInstructions: parsed.data.mmcInstructions ?? undefined,
      splits: muscleGroupSplits,
    });
    const query = z
      .object({ returnTo: z.string().nullable() })
      .parse({ returnTo: new URL(request.url).searchParams.get("returnTo") });
    return redirect(parseExerciseReturnTo(query.returnTo));
  } catch (error) {
    logger.error(
      { err: error, exerciseId },
      "Failed to save catalogue correction",
    );
    return data(
      {
        error:
          "Could not save the correction. Your changes are still here; please retry.",
      },
      { status: 500 },
    );
  }
};

export default function EditExercisePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { exercise } = loaderData;

  return (
    <>
      <Text as="p" size="2" color="gray">
        Catalogue changes apply to every workout using this exercise. Muscle
        percentages can change historical volume calculations.
      </Text>
      {actionData?.error && (
        <Callout.Root color="red" mt="3">
          <Callout.Text>{actionData.error}</Callout.Text>
        </Callout.Root>
      )}
      <ExerciseForm
        initialExercise={exercise.exercise}
        initialSplits={exercise.muscleGroupSplits}
        mode="edit"
        movementPatterns={movementPatterns}
      />
      <Button asChild variant="soft" color="gray" mt="3">
        <Link to={loaderData.returnTo}>Cancel correction</Link>
      </Button>
    </>
  );
}
