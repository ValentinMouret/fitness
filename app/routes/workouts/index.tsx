import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Text,
} from "@radix-ui/themes";
import { Form, Link, useSearchParams, useFetcher } from "react-router";
import { useState } from "react";
import { Pagination } from "~/components/Pagination";
import { SectionHeader } from "~/components/SectionHeader";
import { EmptyState } from "~/components/EmptyState";
import { WorkoutRepository } from "~/modules/fitness/infra/workout.repository.server";
import { WorkoutAnalysisService } from "~/modules/fitness/application/workout-analysis.service.server";
import { AIFitnessCoachService } from "~/modules/fitness/infra/ai-fitness-coach.service";
import { AIFeedbackModal } from "~/modules/fitness/presentation/components";
import { handleResultError } from "~/utils/errors";
import type { Route } from "./+types/index";
import type { AIFitnessCoachResult } from "~/modules/fitness/infra/ai-fitness-coach.service";

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

export const handle = {
  header: () => ({
    title: "Workouts",
    primaryAction: {
      label: "Start Workout",
      type: "submit",
      onClick: () => {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/workouts/create";
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      },
    },
  }),
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "get-ai-feedback") {
    try {
      const analysisDataResult =
        await WorkoutAnalysisService.generateAnalysisData();

      if (analysisDataResult.isErr()) {
        return {
          error:
            analysisDataResult.error === "insufficient_data"
              ? "Not enough workout data for analysis. Complete at least 5 workouts to get AI feedback."
              : "Failed to analyze workout data. Please try again.",
        };
      }

      const aiResult = await AIFitnessCoachService.analyzeWorkouts(
        analysisDataResult.value,
      );

      if (aiResult.isErr()) {
        return {
          error: "Failed to generate AI feedback. Please try again later.",
        };
      }

      return {
        aiFeedback: aiResult.value,
      };
    } catch (error) {
      console.error("AI feedback error:", error);
      return {
        error: "An unexpected error occurred while generating feedback.",
      };
    }
  }

  return { error: "Invalid action" };
};

export default function WorkoutsPage({ loaderData }: Route.ComponentProps) {
  const { workouts, pagination } = loaderData;
  const [_searchParams, setSearchParams] = useSearchParams();
  const [showAIModal, setShowAIModal] = useState(false);
  const aiFetcher = useFetcher<{
    aiFeedback?: AIFitnessCoachResult;
    error?: string;
  }>();

  const handlePageChange = (page: number) => {
    setSearchParams({ page: page.toString() });
  };

  const handleAIFeedback = () => {
    setShowAIModal(true);
    aiFetcher.submit({ intent: "get-ai-feedback" }, { method: "POST" });
  };
  return (
    <>
      <Flex direction="column" gap="4">
        {workouts.length === 0 ? (
          <EmptyState
            icon="💪"
            title="No workouts yet"
            description="Ready to crush it? Hit 'Create Workout' to get started!"
          />
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
                      <Text weight="bold" size="4">
                        {workout.name}
                      </Text>
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
                      <Text size="2" color="tomato">
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

      <Card size="3" mt="6">
        <SectionHeader title="Tools" />
        <Flex gap="3" wrap="wrap">
          <Button
            variant="outline"
            size="2"
            onClick={handleAIFeedback}
            disabled={aiFetcher.state === "submitting" || workouts.length < 5}
          >
            🤖 AI Feedback
          </Button>
          <Button variant="outline" size="2" asChild>
            <Link to="/workouts/generate">Generate Smart Workout</Link>
          </Button>
          <Button variant="outline" size="2" asChild>
            <Link to="/workouts/import">Import from Strong</Link>
          </Button>
          <Button variant="outline" size="2" asChild>
            <Link to="/workouts/exercises">Manage Exercises</Link>
          </Button>
        </Flex>
      </Card>

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
