import {
  Button,
  Container,
  Flex,
  Heading,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { ExerciseMuscleGroupsRepository } from "~/modules/fitness/infra/repository.server";
import type { Route } from "./+types";
import {
  exerciseTypes,
  parseExerciseType,
} from "~/modules/fitness/domain/workout";
import { Form, Link, useSearchParams } from "react-router";
import ExerciseCard from "~/components/ExerciseCard";
import { humanFormatting } from "~/strings";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  const searchParams = url.searchParams;

  const allExercises = await ExerciseMuscleGroupsRepository.listAll({
    type: parseExerciseType(searchParams.get("type") ?? "").unwrapOr(undefined),
    q: searchParams.get("q")?.toString(),
  });

  if (allExercises.isErr()) {
    throw new Error("Error fetching exercises");
  }

  return {
    allExercises: allExercises.value,
  };
};

export const action = () => {};

export default function ExercisesIndexPage({
  loaderData,
}: Route.ComponentProps) {
  const [_, setSearchParams] = useSearchParams();
  const { allExercises } = loaderData;

  return (
    <>
      <Flex gap="3">
        <Heading>Exercises</Heading>
        <Button asChild>
          <Link to="/workouts/exercises/create">Add exercise</Link>
        </Button>
      </Flex>
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
              key={exercise.exercise.name}
              exerciseMuscleGroup={exercise}
            />
          ))}
        </Flex>
      )}
    </>
  );
}
