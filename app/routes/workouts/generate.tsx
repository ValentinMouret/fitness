import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/generate";
import { AdaptiveWorkoutService } from "~/modules/fitness/application/adaptive-workout-service.server";
import { AdaptiveWorkoutRepository } from "~/modules/fitness/infra/adaptive-workout-repository.server";
import { VolumeTrackingService } from "~/modules/fitness/application/volume-tracking-service.server";
import {
  WorkoutRepository,
  WorkoutSessionRepository,
} from "~/modules/fitness/infra/workout.repository.server";
import {
  Card,
  Button,
  TextField,
  Select,
  Checkbox,
  Badge,
  Callout,
  Progress,
  Grid,
  Flex,
  Text,
  Heading,
  Box,
  Separator,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  LightningBoltIcon,
  StopwatchIcon,
  TargetIcon,
} from "@radix-ui/react-icons";
import { Dumbbell, Activity } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  const volumeNeedsResult = await VolumeTrackingService.getVolumeNeeds();
  const progressResult = await VolumeTrackingService.getWeeklyProgress();

  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load available equipment");
  }

  if (volumeNeedsResult.isErr()) {
    throw new Error("Failed to load volume needs");
  }

  if (progressResult.isErr()) {
    throw new Error("Failed to load weekly progress");
  }

  return {
    availableEquipment: availableEquipmentResult.value,
    volumeNeeds: Array.from(volumeNeedsResult.value.entries()),
    weeklyProgress: {
      ...progressResult.value,
      progressPercentage: Array.from(
        progressResult.value.progressPercentage.entries(),
      ),
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const targetDuration = Number(formData.get("targetDuration"));
  const preferredFloor = formData.get("preferredFloor")?.toString();
  const selectedEquipment = formData.getAll("equipment") as string[];

  if (!targetDuration || targetDuration <= 0) {
    return { error: "Please provide a valid target duration" };
  }

  // Get all available equipment
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    return { error: "Failed to load equipment data" };
  }

  // Filter to only selected equipment
  const selectedEquipmentInstances = availableEquipmentResult.value.filter(
    (equipment) => selectedEquipment.includes(equipment.id),
  );

  // Get current volume needs
  const volumeNeedsResult = await VolumeTrackingService.getVolumeNeeds();
  if (volumeNeedsResult.isErr()) {
    return { error: "Failed to load volume needs" };
  }

  // Generate adaptive workout
  const workoutResult = await AdaptiveWorkoutService.generateWorkout({
    availableEquipment: selectedEquipmentInstances,
    targetDuration,
    preferredFloor: preferredFloor ? Number(preferredFloor) : undefined,
    volumeNeeds: volumeNeedsResult.value,
  });

  if (workoutResult.isErr()) {
    return {
      error:
        workoutResult.error === "no_available_equipment"
          ? "No exercises available with selected equipment"
          : workoutResult.error === "insufficient_exercises"
            ? "Not enough exercises found to create a complete workout"
            : "Failed to generate workout",
    };
  }

  // Save the generated workout to database (remove temp ID)
  const { id, ...workoutWithoutId } = workoutResult.value.workout.workout;
  const savedWorkoutResult = await WorkoutRepository.save(workoutWithoutId);
  if (savedWorkoutResult.isErr()) {
    return { error: "Failed to save workout" };
  }

  const savedWorkout = savedWorkoutResult.value;

  // Save workout exercises
  for (const [
    index,
    exerciseGroup,
  ] of workoutResult.value.workout.exerciseGroups.entries()) {
    const addExerciseResult = await WorkoutSessionRepository.addExercise(
      savedWorkout.id,
      exerciseGroup.exercise.id,
      index,
      exerciseGroup.notes,
    );
    if (addExerciseResult.isErr()) {
      return {
        error: `Failed to add exercise: ${exerciseGroup.exercise.name}`,
      };
    }
  }

  // Redirect to the workout page
  throw redirect(`/workouts/${savedWorkout.id}`);
}

export default function GenerateWorkout({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { availableEquipment, volumeNeeds, weeklyProgress } = loaderData;

  return (
    <Box className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <Box mb="8">
        <Flex align="center" gap="3" mb="3">
          <LightningBoltIcon width="32" height="32" />
          <Heading size="8">Generate Adaptive Workout</Heading>
        </Flex>
        <Text size="4" color="gray">
          Create a personalized workout based on available equipment and your
          volume needs
        </Text>
      </Box>

      {/* Weekly Progress Overview */}
      <Card size="3" mb="6">
        <Flex align="center" gap="2" mb="4">
          <Activity size={20} />
          <Heading size="5">Weekly Progress</Heading>
        </Flex>

        <Grid columns={{ initial: "2", md: "4" }} gap="4" mb="4">
          {weeklyProgress.progressPercentage.map(([muscleGroup, progress]) => (
            <Box key={muscleGroup} className="text-center">
              <Text size="2" weight="medium" className="capitalize" mb="1">
                {muscleGroup}
              </Text>
              <Progress value={progress} size="2" mb="2" />
              <Text
                size="3"
                weight="bold"
                color={progress >= 70 ? "green" : "red"}
              >
                {Math.round(progress)}%
              </Text>
            </Box>
          ))}
        </Grid>

        <Callout.Root color={weeklyProgress.isOnTrack ? "green" : "orange"}>
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
      </Card>

      <Form method="post">
        <Grid columns="1" gap="6">
          {/* Workout Configuration */}
          <Card size="3">
            <Flex align="center" gap="2" mb="4">
              <TargetIcon width="20" height="20" />
              <Heading size="4">Workout Configuration</Heading>
            </Flex>

            <Grid columns={{ initial: "1", md: "2" }} gap="4">
              {/* Target Duration */}
              <Box>
                <Text as="label" size="2" weight="medium" mb="2">
                  Target Duration (minutes)
                </Text>
                <TextField.Root
                  type="number"
                  name="targetDuration"
                  defaultValue="45"
                  min="20"
                  max="120"
                  step="5"
                  required
                  size="3"
                >
                  <TextField.Slot>
                    <StopwatchIcon width="16" height="16" />
                  </TextField.Slot>
                </TextField.Root>
              </Box>

              {/* Preferred Floor */}
              <Box>
                <Text as="label" size="2" weight="medium" mb="2">
                  Preferred Floor (optional)
                </Text>
                <Select.Root name="preferredFloor" size="3">
                  <Select.Trigger placeholder="No preference" />
                  <Select.Content>
                    <Select.Item value="1">Floor 1</Select.Item>
                    <Select.Item value="2">Floor 2</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Box>
            </Grid>
          </Card>

          {/* Equipment Selection */}
          <Card size="3">
            <Flex align="center" gap="2" mb="4">
              <Dumbbell size={20} />
              <Heading size="4">Available Equipment</Heading>
            </Flex>

            <Grid
              columns={{ initial: "1", sm: "2", md: "3" }}
              gap="3"
              className="max-h-64 overflow-y-auto"
            >
              {availableEquipment.map((equipment) => (
                <Flex
                  key={equipment.id}
                  align="center"
                  gap="2"
                  p="2"
                  className="rounded-md border"
                >
                  <Checkbox
                    name="equipment"
                    value={equipment.id}
                    defaultChecked={equipment.isAvailable}
                    disabled={!equipment.isAvailable}
                  />
                  <Box>
                    <Text size="2" weight="medium">
                      {equipment.name}
                    </Text>
                    <Flex align="center" gap="2" mt="1">
                      <Badge size="1" color="blue">
                        {equipment.exerciseType}
                      </Badge>
                      {!equipment.isAvailable && (
                        <Badge size="1" color="red">
                          Unavailable
                        </Badge>
                      )}
                    </Flex>
                  </Box>
                </Flex>
              ))}
            </Grid>
          </Card>

          {/* Volume Needs Preview */}
          <Card size="3">
            <Heading size="4" mb="3">
              Remaining Volume Needs This Week
            </Heading>
            <Grid columns={{ initial: "2", md: "4" }} gap="3">
              {volumeNeeds.map(([muscleGroup, sets]) => (
                <Box
                  key={muscleGroup}
                  p="2"
                  className="text-center rounded-md bg-blue-50"
                >
                  <Text size="2" weight="medium" className="capitalize">
                    {muscleGroup}
                  </Text>
                  <Text size="3" weight="bold" color="blue" mt="1">
                    {sets} sets
                  </Text>
                </Box>
              ))}
            </Grid>
          </Card>

          {/* Submit Button */}
          <Button type="submit" size="4" className="w-full">
            <LightningBoltIcon width="16" height="16" />
            Generate Adaptive Workout
          </Button>
        </Grid>
      </Form>

      {/* Action Results */}
      {actionData?.error && (
        <Callout.Root color="red" size="2" mt="6">
          <Callout.Icon>
            <CrossCircledIcon />
          </Callout.Icon>
          <Callout.Text>{actionData.error}</Callout.Text>
        </Callout.Root>
      )}

      {actionData?.success && actionData.workout && (
        <Card size="3" mt="6">
          <Callout.Root color="green" size="2" mb="4">
            <Callout.Icon>
              <CheckCircledIcon />
            </Callout.Icon>
            <Callout.Text>{actionData.message}</Callout.Text>
          </Callout.Root>

          <Grid columns={{ initial: "1", md: "2" }} gap="4" mb="4">
            <Flex align="center" gap="2">
              <StopwatchIcon width="16" height="16" />
              <Text size="2">
                <Text weight="medium">Estimated Duration:</Text>{" "}
                {actionData.workout.estimatedDuration} minutes
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <TargetIcon width="16" height="16" />
              <Text size="2">
                <Text weight="medium">Floor Switches:</Text>{" "}
                {actionData.workout.floorSwitches}
              </Text>
            </Flex>
          </Grid>

          <Separator size="4" mb="4" />

          <Box>
            <Heading size="4" mb="3">
              Generated Exercises
            </Heading>
            <Grid gap="2">
              {actionData.workout.workout.exerciseGroups.map((group, index) => (
                <Card key={group.exercise.id} size="1">
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="3">
                      <Badge size="1" color="gray">
                        {index + 1}
                      </Badge>
                      <Text size="2" weight="medium">
                        {group.exercise.name}
                      </Text>
                      <Badge size="1" color="blue">
                        {group.exercise.type}
                      </Badge>
                    </Flex>
                    <Badge size="1" color="green" className="capitalize">
                      {group.exercise.movementPattern}
                    </Badge>
                  </Flex>
                </Card>
              ))}
            </Grid>
          </Box>
        </Card>
      )}
    </Box>
  );
}
