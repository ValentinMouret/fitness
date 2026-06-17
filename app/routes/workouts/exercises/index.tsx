import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Container, Flex, Select, TextField } from "@radix-ui/themes";
import { Form, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { EmptyState } from "~/components/EmptyState";
import ExerciseCard from "~/components/ExerciseCard";
import { exerciseTypes } from "~/modules/fitness/domain/workout";
import {
  deleteExercise,
  getExercisesPageData,
} from "~/modules/fitness/infra/exercises-page.service.server";
import { humanFormatting } from "~/strings";
import { formText } from "~/utils/form-data";
import type { Route } from "./+types";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { allExercises } = loaderData;

  const hasFilters = !!(searchParams.get("q") || searchParams.get("type"));

  const clearFilters = () => {
    setSearchParams((ps) => {
      ps.delete("q");
      ps.delete("type");
      return ps;
    });
  };

  return (
    <>
      <Container pt="2">
        <Form>
          <Flex gap="2">
            <Select.Root
              name="type"
              value={searchParams.get("type") ?? "all"}
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
              <Select.Trigger
                placeholder="Filter by type"
                aria-label="Filter by exercise type"
              />
              <Select.Content>
                {["all", ...exerciseTypes].map((t) => (
                  <Select.Item key={t} value={t}>
                    {humanFormatting(t)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <TextField.Root
              type="search"
              name="q"
              placeholder="Search exercises..."
              aria-label="Search exercises"
              defaultValue={searchParams.get("q") ?? ""}
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Flex>
        </Form>
      </Container>
      {allExercises.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon="🔍"
            title="No exercises found"
            description="Try adjusting your search or filters to find what you're looking for."
            actionLabel="Clear Filters"
            onAction={clearFilters}
          />
        ) : (
          <EmptyState
            icon="🏋️"
            title="No exercises yet"
            description="Your exercise library is empty. Add your first exercise to start tracking your progress!"
            actionLabel="Add Exercise"
            actionTo="/workouts/exercises/create"
          />
        )
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
