import { PlusIcon } from "@radix-ui/react-icons";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { EmptyState } from "~/components/EmptyState";
import { Pagination } from "~/components/Pagination";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import { getWorkoutsPageData } from "~/modules/fitness/infra/workouts-page.service.server";
import { isEditableTarget } from "~/utils/dom";
import type { Route } from "./+types/index";
import "./index.css";

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  const data = await getWorkoutsPageData(
    context.get(authenticatedUserContext).id,
    { page, limit },
  );
  return {
    ...data,
    workoutDateLabels: Object.fromEntries(
      data.workouts.map((workout) => [
        workout.id,
        formatWorkoutDate(workout.start),
      ]),
    ),
  };
};

export const handle = {
  header: () => ({
    title: "Workouts",
    subtitle: "Training log",
    customRight: <StartWorkoutButton />,
  }),
};

function StartWorkoutButton() {
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const isBusy = navigation.state !== "idle";
  const [isShortcutReady, setIsShortcutReady] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') !==
          null ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target)
      )
        return;
      if (event.key.toLowerCase() === "s" && !isBusy) {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    setIsShortcutReady(true);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy]);

  return (
    <Form ref={formRef} method="post" action="/workouts/create">
      <Button
        type="submit"
        size="3"
        variant="soft"
        disabled={isBusy}
        loading={isBusy}
        aria-keyshortcuts={isShortcutReady ? "s" : undefined}
      >
        <PlusIcon /> Start Workout
      </Button>
    </Form>
  );
}

export const action = () => {
  return new Response("Invalid action", { status: 400 });
};

function formatWorkoutDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today \u00B7 ${time}`;
  if (isYesterday) return `Yesterday \u00B7 ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u00B7 ${time}`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace(/\.0$/, "")}t`;
  return `${kg} kg`;
}

export default function WorkoutsPage({ loaderData }: Route.ComponentProps) {
  const { workouts, pagination, workoutDateLabels } = loaderData;
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const [_searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const handlePageChange = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  return (
    <>
      <Box>
        {workouts.length === 0 ? (
          <EmptyState
            icon="💪"
            title="No workouts yet"
            description="Ready to crush it? Let's get moving."
            actionLabel="Get Started"
            onAction={() => {
              if (navigation.state === "idle")
                submit({}, { method: "post", action: "/workouts/create" });
            }}
          />
        ) : (
          workouts.map((workout, i) => {
            const isActive = !workout.stop;
            return (
              <Box key={workout.id}>
                {i > 0 && <hr className="rule-divider" />}
                <Link
                  to={`/workouts/${workout.id}`}
                  className="workouts-index__link"
                >
                  <Box py="4">
                    <Flex justify="between" align="start">
                      <Box className="workouts-index__main">
                        <Text
                          size="4"
                          weight="bold"
                          className="workouts-index__title"
                        >
                          {workout.name}
                        </Text>
                        <Text
                          as="p"
                          size="2"
                          mt="1"
                          className="workouts-index__muted"
                        >
                          {isHydrated
                            ? formatWorkoutDate(workout.start)
                            : workoutDateLabels[workout.id]}
                        </Text>
                        <Flex gap="3" mt="1">
                          {workout.exerciseCount > 0 && (
                            <Text size="1" className="workouts-index__muted">
                              {workout.exerciseCount} exercises
                            </Text>
                          )}
                          {workout.setCount > 0 && (
                            <Text size="1" className="workouts-index__muted">
                              {workout.setCount} sets
                            </Text>
                          )}
                          {workout.durationMinutes != null && (
                            <Text size="1" className="workouts-index__muted">
                              {workout.durationMinutes} min
                            </Text>
                          )}
                          {workout.totalVolumeKg > 0 && (
                            <Text size="1" className="workouts-index__muted">
                              {formatVolume(workout.totalVolumeKg)}
                            </Text>
                          )}
                        </Flex>
                      </Box>
                      <span
                        className={`workouts-index__status ${isActive ? "workouts-index__status--active" : "workouts-index__status--done"}`}
                      >
                        {isActive ? "Active" : "Done"}
                      </span>
                    </Flex>
                  </Box>
                </Link>
              </Box>
            );
          })
        )}
      </Box>

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />

      <Flex gap="3" wrap="wrap" mt="6">
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/exercises">Manage Exercises</Link>
        </Button>
      </Flex>
    </>
  );
}
