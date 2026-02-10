import {
  CheckCircledIcon,
  CrossCircledIcon,
  LightningBoltIcon,
  TargetIcon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Progress,
  Select,
  Text,
} from "@radix-ui/themes";
import { Activity, Dumbbell } from "lucide-react";
import type { ActionFunctionArgs } from "react-router";
import { Form } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { NumberInput } from "~/components/NumberInput";
import {
  generateWorkout,
  getGenerateWorkoutData,
} from "~/modules/fitness/application/generate-workout.service.server";
import {
  formNumber,
  formOptionalText,
  formRepeatableText,
} from "~/utils/form-data";
import type { Route } from "./+types/generate";

export async function loader() {
  return getGenerateWorkoutData();
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const schema = zfd.formData({
    targetDuration: formNumber(z.number().int().min(1)),
    preferredFloor: formOptionalText(),
    equipment: formRepeatableText(),
  });
  const parsed = schema.parse(formData);

  return generateWorkout({
    targetDuration: parsed.targetDuration,
    preferredFloor: parsed.preferredFloor ?? undefined,
    selectedEquipmentIds: parsed.equipment,
  });
}

export default function GenerateWorkout({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { availableEquipment, volumeNeeds, weeklyProgress } = loaderData;
  actionData;

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
                <NumberInput
                  allowDecimals={false}
                  name="targetDuration"
                  defaultValue="45"
                  min="20"
                  max="120"
                  required
                  size="3"
                />
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
    </Box>
  );
}
