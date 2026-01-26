import {
  ActivityLogIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Progress,
  Spinner,
  Strong,
  Text,
} from "@radix-ui/themes";
import type { AIFitnessCoachResult } from "../../../infra/ai-fitness-coach.service";

interface AIFeedbackModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly feedback: AIFitnessCoachResult | null;
  readonly loading: boolean;
  readonly error?: string;
}

export function AIFeedbackModal({
  open,
  onClose,
  feedback,
  loading,
  error,
}: AIFeedbackModalProps) {
  if (!feedback && !loading && !error) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content
        maxWidth="800px"
        style={{
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <Flex justify="between" align="center" mb="4">
          <Heading size="6">🤖 AI Fitness Coach Feedback</Heading>
          <IconButton variant="ghost" onClick={onClose}>
            <Cross2Icon />
          </IconButton>
        </Flex>

        {loading && (
          <Flex direction="column" gap="4" align="center" py="8">
            <Spinner size="2" />
            <Text>Analyzing your workout data...</Text>
          </Flex>
        )}

        {error && (
          <Card>
            <Flex direction="column" gap="2" align="center" p="4">
              <Text color="red" weight="bold">
                Analysis Failed
              </Text>
              <Text color="gray">{error}</Text>
              <Button variant="soft" onClick={onClose}>
                Close
              </Button>
            </Flex>
          </Card>
        )}

        {feedback && (
          <Flex direction="column" gap="6">
            {/* Progression Analysis */}
            <Card>
              <Flex direction="column" gap="4" p="4">
                <Flex align="center" gap="2">
                  <TrendIcon
                    trend={feedback.analysis.progressionAnalysis.overallTrend}
                  />
                  <Heading size="4">Progression Analysis</Heading>
                  <Badge
                    color={getTrendColor(
                      feedback.analysis.progressionAnalysis.overallTrend,
                    )}
                    variant="soft"
                  >
                    {feedback.analysis.progressionAnalysis.overallTrend}
                  </Badge>
                </Flex>

                <Box>
                  <Text size="2" color="gray" weight="bold">
                    Consistency Score
                  </Text>
                  <Flex align="center" gap="2" mt="1">
                    <Progress
                      value={
                        feedback.analysis.progressionAnalysis.consistencyScore *
                        10
                      }
                      style={{ flex: 1 }}
                    />
                    <Text size="2" weight="bold">
                      {feedback.analysis.progressionAnalysis.consistencyScore}
                      /10
                    </Text>
                  </Flex>
                </Box>

                <Box>
                  <Strong>Strength Gains:</Strong>
                  <Text as="p" mt="1" color="gray">
                    {feedback.analysis.progressionAnalysis.strengthGains}
                  </Text>
                </Box>

                <Box>
                  <Strong>Volume Progression:</Strong>
                  <Text as="p" mt="1" color="gray">
                    {feedback.analysis.progressionAnalysis.volumeProgression}
                  </Text>
                </Box>
              </Flex>
            </Card>

            {/* Observations */}
            <Card>
              <Flex direction="column" gap="4" p="4">
                <Heading size="4">Key Observations</Heading>

                <ObservationSection
                  title="Muscle Group Balance"
                  content={feedback.analysis.observations.muscleGroupBalance}
                />

                <ObservationSection
                  title="Exercise Variety"
                  content={feedback.analysis.observations.exerciseVariety}
                />

                <ObservationSection
                  title="Workout Frequency"
                  content={feedback.analysis.observations.workoutFrequency}
                />

                <ObservationSection
                  title="Recovery Patterns"
                  content={feedback.analysis.observations.recoveryPatterns}
                />
              </Flex>
            </Card>

            {/* Suggestions */}
            <Card>
              <Flex direction="column" gap="4" p="4">
                <Heading size="4">Suggestions</Heading>

                <SuggestionSection
                  title="Immediate Actions"
                  items={feedback.analysis.suggestions.immediateActions}
                  color="red"
                />

                <SuggestionSection
                  title="Program Adjustments"
                  items={feedback.analysis.suggestions.programAdjustments}
                  color="orange"
                />

                <SuggestionSection
                  title="Exercise Recommendations"
                  items={feedback.analysis.suggestions.exerciseRecommendations}
                  color="blue"
                />
              </Flex>
            </Card>

            {/* Things to Try */}
            <Card>
              <Flex direction="column" gap="4" p="4">
                <Heading size="4">Things to Try</Heading>

                <SuggestionSection
                  title="New Exercises"
                  items={feedback.analysis.thingsToTry.newExercises}
                  color="green"
                />

                <SuggestionSection
                  title="Training Techniques"
                  items={feedback.analysis.thingsToTry.trainingTechniques}
                  color="purple"
                />

                <SuggestionSection
                  title="Periodization Changes"
                  items={feedback.analysis.thingsToTry.periodizationChanges}
                  color="cyan"
                />
              </Flex>
            </Card>

            {/* Footer */}
            <Flex justify="between" align="center" pt="4">
              <Text size="1" color="gray">
                Analysis based on your training data • {feedback.tokensUsed}{" "}
                tokens used
              </Text>
              <Button onClick={onClose}>Close</Button>
            </Flex>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function TrendIcon({
  trend,
}: {
  trend: "improving" | "plateauing" | "declining";
}) {
  switch (trend) {
    case "improving":
      return <ArrowUpIcon color="green" />;
    case "declining":
      return <ArrowDownIcon color="red" />;
    default:
      return <ActivityLogIcon color="orange" />;
  }
}

function getTrendColor(trend: "improving" | "plateauing" | "declining") {
  switch (trend) {
    case "improving":
      return "green";
    case "declining":
      return "red";
    default:
      return "orange";
  }
}

function ObservationSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <Box>
      <Text size="2" weight="bold" color="gray">
        {title}
      </Text>
      <Text as="p" mt="1" size="2">
        {content}
      </Text>
    </Box>
  );
}

function SuggestionSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: "red" | "orange" | "blue" | "green" | "purple" | "cyan";
}) {
  if (items.length === 0) return null;

  return (
    <Box>
      <Text size="2" weight="bold" color="gray" mb="2">
        {title}
      </Text>
      <Flex direction="column" gap="2">
        {items.map((item, index) => (
          <Flex
            key={`suggestion-${title}-${item.slice(0, 20)}-${index}`}
            align="start"
            gap="2"
          >
            <Badge size="1" color={color} variant="soft">
              {index + 1}
            </Badge>
            <Text size="2" style={{ flex: 1 }}>
              {item}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
