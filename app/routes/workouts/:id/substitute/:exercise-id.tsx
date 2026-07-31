import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  ScrollArea,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import { Form, Link, useNavigation } from "react-router";
import { zfd } from "zod-form-data";
import {
  getSubstituteExerciseData,
  substituteExercise,
} from "~/modules/fitness/infra/substitute-exercise.service.server";
import { formRepeatableText } from "~/utils/form-data";
import type { Route } from "./+types/:exercise-id";

export async function loader({ params }: Route.LoaderArgs) {
  const workoutId = params.id;
  const exerciseId = params["exercise-id"];

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  return getSubstituteExerciseData({ workoutId, exerciseId });
}

export async function action({ params, request }: Route.ActionArgs) {
  const workoutId = params.id;
  const exerciseId = params["exercise-id"];
  const formData = await request.formData();
  const schema = zfd.formData({
    equipment: formRepeatableText(),
  });
  const parsed = schema.parse(formData);
  const selectedEquipment = parsed.equipment;

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  return substituteExercise({
    workoutId,
    exerciseId,
    selectedEquipmentIds: selectedEquipment,
  });
}

export const handle = {
  header: (data: Route.ComponentProps["loaderData"]) => ({
    title: "Find Exercise Substitute",
    backTo: `/workouts/${data?.workoutId || ""}`,
  }),
};

export default function SubstituteExercise({
  loaderData,
}: Route.ComponentProps) {
  const { workoutId, availableEquipment, potentialSubstitutes } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const formRef = useRef<HTMLFormElement>(null);

  // Focus the first checkbox on mount to assist keyboard navigation
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstCheckboxRef.current?.focus();
  }, []);

  // Handle Cmd/Ctrl + Enter global/form keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (formRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Box maxWidth="600px" mx="auto" pt="4" px="2">
      <Card size="3" mb="4">
        <Text size="2" color="gray" mb="4" as="div">
          Select available equipment to find suitable exercise alternatives.
        </Text>

        <Form ref={formRef} method="post">
          <Flex direction="column" gap="4">
            <Box>
              <Text as="div" size="2" weight="bold" mb="2">
                Available Equipment
              </Text>
              <Card variant="ghost" style={{ padding: 0 }}>
                <ScrollArea scrollbars="vertical" style={{ maxHeight: 220 }}>
                  <Flex direction="column" gap="2" p="2" pr="4">
                    {availableEquipment.map((equipment, idx) => (
                      <label
                        key={equipment.id}
                        htmlFor={equipment.id}
                        style={{ cursor: "pointer" }}
                      >
                        <Flex gap="3" align="center">
                          <input
                            ref={idx === 0 ? firstCheckboxRef : undefined}
                            type="checkbox"
                            id={equipment.id}
                            name="equipment"
                            value={equipment.id}
                            defaultChecked={equipment.isAvailable}
                            style={{
                              width: 16,
                              height: 16,
                              accentColor: "var(--accent-9)",
                              cursor: "pointer",
                            }}
                          />
                          <Text size="2">
                            {equipment.name}{" "}
                            <Text size="1" color="gray">
                              ({equipment.exerciseType})
                            </Text>
                            {!equipment.isAvailable && (
                              <Text size="1" color="red" ml="2">
                                (Unavailable)
                              </Text>
                            )}
                          </Text>
                        </Flex>
                      </label>
                    ))}
                  </Flex>
                </ScrollArea>
              </Card>
            </Box>

            {potentialSubstitutes.length > 0 ? (
              <Callout.Root color="blue" size="2">
                <Callout.Text>
                  <Text size="2" weight="bold" mb="2" as="div">
                    Potential Substitute Exercises
                  </Text>
                  <Flex direction="column" gap="1">
                    {potentialSubstitutes.slice(0, 5).map((substitute) => (
                      <Flex
                        key={substitute.exercise.id}
                        justify="between"
                        align="center"
                      >
                        <Text size="2" weight="medium">
                          {substitute.exercise.name}
                        </Text>
                        <Text
                          size="1"
                          color="gray"
                          style={{ textTransform: "capitalize" }}
                        >
                          {substitute.exercise.type} ·{" "}
                          {substitute.exercise.movementPattern}
                        </Text>
                      </Flex>
                    ))}
                    {potentialSubstitutes.length > 5 && (
                      <Text
                        size="1"
                        color="gray"
                        style={{ fontStyle: "italic" }}
                        mt="1"
                      >
                        +{potentialSubstitutes.length - 5} more options
                        available
                      </Text>
                    )}
                  </Flex>
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Callout.Root color="yellow" size="2">
                <Callout.Text>
                  <Text size="2">
                    No pre-defined substitute exercises found. The system will
                    find the best available alternative based on your equipment
                    selection.
                  </Text>
                </Callout.Text>
              </Callout.Root>
            )}

            <Flex gap="3" mt="2">
              <Tooltip content="Find Substitute (Cmd+Enter)">
                <Box display="inline-block" style={{ flex: 1 }}>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    style={{ width: "100%" }}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                  >
                    Find Substitute
                  </Button>
                </Box>
              </Tooltip>

              <Tooltip content="Cancel and return to workout">
                <Box display="inline-block" style={{ flex: 1 }}>
                  <Button
                    variant="soft"
                    color="gray"
                    style={{ width: "100%" }}
                    asChild
                  >
                    <Link to={`/workouts/${workoutId}`}>Cancel</Link>
                  </Button>
                </Box>
              </Tooltip>
            </Flex>
          </Flex>
        </Form>
      </Card>
    </Box>
  );
}
