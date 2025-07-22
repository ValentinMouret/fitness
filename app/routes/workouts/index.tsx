import {
  Container,
  Heading,
  Link as RadixLink,
  Button,
  Flex,
  Box,
  Card,
  Text,
} from "@radix-ui/themes";
import { Link, Form } from "react-router";
import type { Route } from "./+types/index";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";

export const loader = async () => {
  const result = await WorkoutRepository.findAll();
  if (result.isErr()) {
    throw new Error("Failed to load workouts");
  }
  return { workouts: result.value };
};

export default function WorkoutsPage({ loaderData }: Route.ComponentProps) {
  const { workouts } = loaderData;
  return (
    <Container>
      <Flex justify="between" align="center" mb="6">
        <Heading size="8">Workouts</Heading>
        <Flex gap="3" align="center">
          <RadixLink asChild>
            <Link to="/workouts/exercises">Manage Exercises</Link>
          </RadixLink>
          <Form action="/workouts/create" method="post">
            <Button type="submit" size="3">
              Create Workout
            </Button>
          </Form>
        </Flex>
      </Flex>

      <Flex direction="column" gap="4">
        {workouts.length === 0 ? (
          <Card>
            <Text>No workouts found. Create your first workout!</Text>
          </Card>
        ) : (
          workouts.map((workout) => (
            <Card key={workout.id} asChild>
              <Link
                to={`/workouts/${workout.id}`}
                style={{ textDecoration: "none" }}
              >
                <Flex justify="between" align="center" p="4">
                  <Box>
                    <Heading size="4">{workout.name}</Heading>
                    <Text size="2" color="gray">
                      {workout.start.toLocaleDateString()} at{" "}
                      {workout.start.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Box>
                  <Box>
                    {workout.stop ? (
                      <Text size="2" color="green">
                        Completed
                      </Text>
                    ) : (
                      <Text size="2" color="orange">
                        In Progress
                      </Text>
                    )}
                  </Box>
                </Flex>
              </Link>
            </Card>
          ))
        )}
      </Flex>
    </Container>
  );
}
