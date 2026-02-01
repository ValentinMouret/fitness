import { Container, Flex, Select, Text, TextField } from "@radix-ui/themes";
import type { Route } from "./+types";
import { exerciseTypes } from "~/modules/fitness/domain/workout";
import { Form, useSearchParams } from "react-router";
import ExerciseCard from "~/components/ExerciseCard";
import { humanFormatting } from "~/strings";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { z } from "zod";
import { zfd } from "zod-form-data";
import {
  deleteExercise,
  getExercisesPageData,
} from "~/modules/fitness/application/exercises-page.service.server";
import { formText } from "~/utils/form-data";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const searchParams = url.searchParams;

  return getExercisesPageData({
    typeParam: searchParams.get("type"),
    query: searchParams.get("q"),
  });
};

export const handle = {
  header: () => ({
    title: "Exercises",
    backTo: "/workouts",
    primaryAction: {
      label: "Add Exercise",
      to: "/workouts/exercises/create",
    },
  }),
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const schema = zfd.formData({
    exerciseId: formText(z.string().min(1)),
  });
  const parsed = schema.parse(formData);

  return deleteExercise(parsed.exerciseId);
};

export default function ExercisesIndexPage({
  loaderData,
}: Route.ComponentProps) {
  const [_, setSearchParams] = useSearchParams();
  const { allExercises } = loaderData;

  return (
    <>
      <Container pt="2">
        <Form>
          <Flex gap="2">
            <Select.Root
              name="type"
              onValueChange={(v) => {
                if (v === "all") {
                  setSearchParams((ps) => {
                    ps.delete("type");
                    return ps;
                  });
                } else {
                  setSearchParams((ps) => {
                    ps.set("type", v);
                    return ps;
                  });
                }
              }}
            >
              <Select.Trigger placeholder="Type" />
              <Select.Content>
                {["all", ...exerciseTypes].map((t) => (
                  <Select.Item key={t} value={t}>
                    {humanFormatting(t)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <TextField.Root type="search" name="q">
              <TextField.Slot>
                <MagnifyingGlassIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Flex>
        </Form>
      </Container>
      {allExercises.length === 0 ? (
        <Text>Exercises will show here once you add them</Text>
      ) : (
        <Flex direction="column" pt="4" gap="2">
          {allExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.exercise.id}
              exerciseMuscleGroup={exercise}
            />
          ))}
        </Flex>
      )}
    </>
  );
}
