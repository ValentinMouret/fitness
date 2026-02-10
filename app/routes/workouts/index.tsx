import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { zfd } from "zod-form-data";
import { EmptyState } from "~/components/EmptyState";
import { Pagination } from "~/components/Pagination";
import {
  getAiFeedback,
  getWorkoutsPageData,
} from "~/modules/fitness/application/workouts-page.service.server";
import type { WorkoutWithSummary } from "~/modules/fitness/domain/workout";
import type { AIFitnessCoachResult } from "~/modules/fitness/infra/ai-fitness-coach.service";
import {
  AIFeedbackModal,
  StartWorkoutDialog,
} from "~/modules/fitness/presentation/components";
import { createWorkoutTemplateCardViewModel } from "~/modules/fitness/presentation/view-models/workout-template-card.view-model";
import { formOptionalText } from "~/utils/form-data";
import type { Route } from "./+types/index";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  return getWorkoutsPageData({ page, limit });
};

export const handle = {
  header: () => ({
    title: "Workouts",
    subtitle: "Training log",
    primaryAction: {
      label: "Start Workout",
      type: "button" as const,
      onClick: () => {
        window.dispatchEvent(new CustomEvent("open-start-workout-dialog"));
      },
    },
  }),
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const intentSchema = zfd.formData({
    intent: formOptionalText(),
  });
  const intentParsed = intentSchema.parse(formData);
  const intent = intentParsed.intent;

  if (intent === "get-ai-feedback") {
    return getAiFeedback();
  }

  return { error: "Invalid action" };
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
  const { workouts, templates, pagination } = loaderData;
  const [_searchParams, setSearchParams] = useSearchParams();
  const [showAIModal, setShowAIModal] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const aiFetcher = useFetcher<{
    aiFeedback?: AIFitnessCoachResult;
    error?: string;
  }>();

  useEffect(() => {
    const handler = () => setShowStartDialog(true);
    window.addEventListener("open-start-workout-dialog", handler);
    return () =>
      window.removeEventListener("open-start-workout-dialog", handler);
  }, []);

  const handlePageChange = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  const handleAIFeedback = () => {
    setShowAIModal(true);
    aiFetcher.submit({ intent: "get-ai-feedback" }, { method: "POST" });
  };

  const templateViewModels = templates.map(createWorkoutTemplateCardViewModel);

  return (
    <>
      <Box>
        {workouts.length === 0 ? (
          <EmptyState
            icon="💪"
            title="No workouts yet"
            description="Ready to crush it? Hit 'Start Workout' to get started!"
          />
        ) : (
          workouts.map((workout: WorkoutWithSummary, i: number) => {
            const isActive = !workout.stop;
            return (
              <Box key={workout.id}>
                {i > 0 && <hr className="rule-divider" />}
                <Link
                  to={`/workouts/${workout.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box py="4">
                    <Flex justify="between" align="start">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          size="4"
                          weight="bold"
                          style={{
                            fontFamily: "var(--font-display)",
                            display: "block",
                          }}
                        >
                          {workout.name}
                        </Text>
                        <Text
                          as="p"
                          size="2"
                          mt="1"
                          style={{ color: "var(--brand-text-secondary)" }}
                        >
                          {formatWorkoutDate(workout.start)}
                        </Text>
                        <Flex gap="3" mt="1">
                          {workout.exerciseCount > 0 && (
                            <Text
                              size="1"
                              style={{ color: "var(--brand-text-secondary)" }}
                            >
                              {workout.exerciseCount} exercises
                            </Text>
                          )}
                          {workout.setCount > 0 && (
                            <Text
                              size="1"
                              style={{ color: "var(--brand-text-secondary)" }}
                            >
                              {workout.setCount} sets
                            </Text>
                          )}
                          {workout.durationMinutes != null && (
                            <Text
                              size="1"
                              style={{ color: "var(--brand-text-secondary)" }}
                            >
                              {workout.durationMinutes} min
                            </Text>
                          )}
                          {workout.totalVolumeKg > 0 && (
                            <Text
                              size="1"
                              style={{ color: "var(--brand-text-secondary)" }}
                            >
                              {formatVolume(workout.totalVolumeKg)}
                            </Text>
                          )}
                        </Flex>
                      </Box>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "4px 10px",
                          borderRadius: "100px",
                          background: isActive
                            ? "var(--brand-coral)"
                            : "var(--gray-4)",
                          color: isActive ? "white" : "var(--brand-text)",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
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
        <Button
          variant="outline"
          size="2"
          onClick={handleAIFeedback}
          disabled={aiFetcher.state === "submitting" || workouts.length < 5}
        >
          AI Feedback
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/recovery">Recovery Map</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/templates">Templates</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/generate">Generate Workout</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/import">Import from Strong</Link>
        </Button>
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts/exercises">Manage Exercises</Link>
        </Button>
      </Flex>

      <StartWorkoutDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        templates={templateViewModels}
      />

      <AIFeedbackModal
        open={showAIModal}
        onClose={() => setShowAIModal(false)}
        feedback={aiFetcher.data?.aiFeedback || null}
        loading={aiFetcher.state === "submitting"}
        error={aiFetcher.data?.error}
      />
    </>
  );
}
