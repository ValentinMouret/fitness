import {
  CheckCircledIcon,
  CrossCircledIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Progress,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { Activity } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { NumberInput } from "~/components/NumberInput";
import { AIWorkoutGenerationService } from "~/modules/fitness/application/ai-workout-generation.service.server";
import { createWorkoutFromGeneration } from "~/modules/fitness/application/create-workout-from-generation.service.server";
import { VolumeTrackingService } from "~/modules/fitness/application/volume-tracking-service.server";
import type {
  ConversationMessage,
  GeneratedWorkout,
} from "~/modules/fitness/domain/ai-generation";
import { AIWorkoutGenerationRepository } from "~/modules/fitness/infra/ai-workout-generation.repository.server";
import {
  RefinementChat,
  WorkoutPreview,
} from "~/modules/fitness/presentation/components";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/generate";

export async function loader() {
  const progressResult = await VolumeTrackingService.getWeeklyProgress();

  if (progressResult.isErr()) {
    return {
      weeklyProgress: null,
    };
  }

  return {
    weeklyProgress: {
      ...progressResult.value,
      progressPercentage: Array.from(
        progressResult.value.progressPercentage.entries(),
      ),
    },
  };
}

type ActionResult =
  | {
      intent: "generate";
      workout: GeneratedWorkout;
      conversationId: string;
      messages: ConversationMessage[];
    }
  | {
      intent: "refine";
      workout: GeneratedWorkout;
      conversationId: string;
      messages: ConversationMessage[];
    }
  | { intent: "save-preference"; success: true }
  | { error: string };

export async function action({
  request,
}: Route.ActionArgs): Promise<ActionResult | Response> {
  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  switch (intent) {
    case "generate": {
      const schema = zfd.formData({
        timeConstraint: formOptionalText(),
      });
      const parsed = schema.parse(formData);
      const timeConstraintMinutes = parsed.timeConstraint
        ? Number.parseInt(parsed.timeConstraint, 10)
        : undefined;

      const contextResult = await AIWorkoutGenerationService.assembleContext(
        timeConstraintMinutes,
      );

      if (contextResult.isErr()) {
        return {
          error: `Failed to assemble training context: ${contextResult.error}`,
        };
      }

      const generateResult = await AIWorkoutGenerationService.generateWorkout(
        contextResult.value,
      );

      if (generateResult.isErr()) {
        return { error: `Failed to generate workout: ${generateResult.error}` };
      }

      return {
        intent: "generate",
        workout: generateResult.value.workout,
        conversationId: generateResult.value.conversationId,
        messages: [
          { role: "user", content: "Generate my next workout." },
          { role: "assistant", content: "Here is your generated workout." },
        ],
      };
    }

    case "refine": {
      const schema = zfd.formData({
        conversationId: formText(z.string().min(1)),
        feedback: formText(z.string().min(1)),
      });
      const parsed = schema.parse(formData);

      const refineResult = await AIWorkoutGenerationService.refineWorkout(
        parsed.conversationId,
        parsed.feedback,
      );

      if (refineResult.isErr()) {
        return { error: `Failed to refine workout: ${refineResult.error}` };
      }

      // Fetch updated conversation messages
      const conversationResult =
        await AIWorkoutGenerationRepository.getConversation(
          parsed.conversationId,
        );

      if (conversationResult.isErr()) {
        return { error: "Failed to load conversation" };
      }

      return {
        intent: "refine",
        workout: refineResult.value.workout,
        conversationId: parsed.conversationId,
        messages: (conversationResult.value?.messages ??
          []) as ConversationMessage[],
      };
    }

    case "start": {
      const schema = zfd.formData({
        workout: formText(z.string().min(1)),
        conversationId: formText(z.string().min(1)),
      });
      const parsed = schema.parse(formData);

      const workout: GeneratedWorkout = JSON.parse(parsed.workout);
      return createWorkoutFromGeneration(workout, parsed.conversationId);
    }

    case "save-preference": {
      const schema = zfd.formData({
        content: formText(z.string().min(1)),
      });
      const parsed = schema.parse(formData);

      const result = await AIWorkoutGenerationRepository.savePreference(
        parsed.content,
        "refinement",
      );

      if (result.isErr()) {
        return { error: "Failed to save preference" };
      }

      return { intent: "save-preference", success: true };
    }

    default:
      return { error: `Unknown intent: ${intent}` };
  }
}

export default function GenerateWorkout({ loaderData }: Route.ComponentProps) {
  const { weeklyProgress } = loaderData;
  const generateFetcher = useFetcher<ActionResult>();

  // Track the latest workout/conversation state across generate + refine actions
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout | null>(
    null,
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Update state from fetcher data
  const fetcherData = generateFetcher.data;
  if (fetcherData && "intent" in fetcherData) {
    if (
      (fetcherData.intent === "generate" || fetcherData.intent === "refine") &&
      fetcherData.workout !== currentWorkout
    ) {
      setCurrentWorkout(fetcherData.workout);
      setConversationId(fetcherData.conversationId);
      setMessages(fetcherData.messages);
    }
  }

  const isGenerating =
    generateFetcher.state !== "idle" &&
    generateFetcher.formData?.get("intent") === "generate";
  const isRefining =
    generateFetcher.state !== "idle" &&
    generateFetcher.formData?.get("intent") === "refine";
  const isStarting =
    generateFetcher.state !== "idle" &&
    generateFetcher.formData?.get("intent") === "start";
  const isLoading = isGenerating || isRefining || isStarting;

  const error =
    fetcherData && "error" in fetcherData ? fetcherData.error : null;

  const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("intent", "generate");
    generateFetcher.submit(formData, { method: "post" });
  };

  const handleStart = () => {
    if (!currentWorkout || !conversationId) return;
    generateFetcher.submit(
      {
        intent: "start",
        workout: JSON.stringify(currentWorkout),
        conversationId,
      },
      { method: "post" },
    );
  };

  return (
    <Box className="mx-auto max-w-4xl p-6">
      <Box mb="6">
        <Flex align="center" gap="3" mb="3">
          <LightningBoltIcon width="28" height="28" />
          <Heading size="7">Generate Workout</Heading>
        </Flex>
        <Text size="3" color="gray">
          AI-powered workout generation based on your training history
        </Text>
      </Box>

      {/* Weekly Progress */}
      {weeklyProgress && (
        <Box mb="6" p="4" className="rounded-md border">
          <Flex align="center" gap="2" mb="3">
            <Activity size={18} />
            <Text size="3" weight="medium">
              Weekly Volume Progress
            </Text>
          </Flex>
          <Grid columns={{ initial: "2", md: "4" }} gap="3">
            {weeklyProgress.progressPercentage.map(
              ([muscleGroup, progress]: [string, number]) => (
                <Box key={muscleGroup} className="text-center">
                  <Text size="1" weight="medium" className="capitalize">
                    {muscleGroup}
                  </Text>
                  <Progress value={progress} size="1" mt="1" />
                  <Text size="1" color={progress >= 70 ? "green" : "orange"}>
                    {Math.round(progress)}%
                  </Text>
                </Box>
              ),
            )}
          </Grid>
          <Callout.Root
            color={weeklyProgress.isOnTrack ? "green" : "orange"}
            size="1"
            mt="3"
          >
            <Callout.Icon>
              {weeklyProgress.isOnTrack ? (
                <CheckCircledIcon />
              ) : (
                <CrossCircledIcon />
              )}
            </Callout.Icon>
            <Callout.Text>
              {weeklyProgress.isOnTrack
                ? "On track with weekly goals"
                : "Behind on weekly volume targets"}
            </Callout.Text>
          </Callout.Root>
        </Box>
      )}

      {/* Generate Form (shown when no workout yet) */}
      {!currentWorkout && (
        <form onSubmit={handleGenerate}>
          <Flex direction="column" gap="4">
            <Box>
              <Text as="label" size="2" weight="medium" mb="2">
                Time constraint (minutes, optional)
              </Text>
              <NumberInput
                allowDecimals={false}
                name="timeConstraint"
                placeholder="e.g., 60"
                min="20"
                max="120"
                size="3"
              />
            </Box>
            <Button type="submit" size="3" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Spinner size="1" /> Generating...
                </>
              ) : (
                <>
                  <LightningBoltIcon /> Generate with AI
                </>
              )}
            </Button>
          </Flex>
        </form>
      )}

      {/* Generated Workout Preview */}
      {currentWorkout && (
        <Flex direction="column" gap="4" mt="4">
          <WorkoutPreview workout={currentWorkout} />

          <RefinementChat
            conversationId={conversationId ?? ""}
            messages={messages}
            isLoading={isLoading}
          />

          <Flex gap="3" justify="between">
            <Button
              variant="soft"
              size="3"
              onClick={() => {
                setCurrentWorkout(null);
                setConversationId(null);
                setMessages([]);
              }}
            >
              Start Over
            </Button>
            <Button size="3" onClick={handleStart} disabled={isStarting}>
              {isStarting ? (
                <>
                  <Spinner size="1" /> Creating...
                </>
              ) : (
                "Start Workout"
              )}
            </Button>
          </Flex>
        </Flex>
      )}

      {/* Error display */}
      {error && (
        <Callout.Root color="red" size="2" mt="4">
          <Callout.Icon>
            <CrossCircledIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
}
