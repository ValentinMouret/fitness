import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Link as RadixLink,
  Text,
} from "@radix-ui/themes";
import { Form, Link, useSearchParams } from "react-router";
import { Pagination } from "~/components/Pagination";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { handleResultError } from "~/utils/errors";
import type { Route } from "./+types/index";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 10);

  const result = await WorkoutRepository.findAllWithPagination(
    validPage,
    validLimit,
  );
  if (result.isErr()) {
    handleResultError(result, "Failed to load workouts");
  }

  const { workouts, totalCount } = result.value;
  const totalPages = Math.ceil(totalCount / validLimit);

  return {
    workouts,
    pagination: {
      currentPage: validPage,
      totalPages,
      totalCount,
      limit: validLimit,
    },
  };
};

export default function WorkoutsPage({ loaderData }: Route.ComponentProps) {
  const { workouts, pagination } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePageChange = (page: number) => {
    setSearchParams({ page: page.toString() });
  };
  return (
    <Container>
      <Flex justify="between" align="center" mb="6">
        <Heading size="8">Workouts</Heading>
        <Flex gap="3" align="center">
          <RadixLink asChild>
            <Link to="/workouts/exercises">Manage Exercises</Link>
          </RadixLink>
          <RadixLink asChild>
            <Link to="/workouts/import">
              <Button variant="outline" size="3">
                Import from Strong
              </Button>
            </Link>
          </RadixLink>
          <RadixLink asChild>
            <Link to="/workouts/generate">
              <Button variant="outline" size="3">
                Generate Smart Workout
              </Button>
            </Link>
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
                    <Flex align="center" gap="2" mb="1">
                      <Heading size="4">{workout.name}</Heading>
                      {workout.importedFromStrong && (
                        <Badge size="1" color="blue" variant="soft">
                          Strong
                        </Badge>
                      )}
                    </Flex>
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

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </Container>
  );
}
