import {
  Box,
  Button,
  Callout,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import * as React from "react";
import { data, Form, Link, redirect, useActionData } from "react-router";
import { Habit as HabitEntity } from "../../modules/habits/domain/entity";
import { HabitRepository } from "../../modules/habits/infra/repository.server";
import type { Route } from "./+types/new";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | undefined;
  const frequencyType = formData.get(
    "frequencyType",
  ) as HabitEntity["frequencyType"];

  const frequencyConfig: {
    days_of_week?: string[];
    interval_days?: number;
    day_of_month?: number;
  } = {};
  if (frequencyType === "custom" || frequencyType === "weekly") {
    const daysOfWeek = formData.getAll("daysOfWeek").map(String);
    if (daysOfWeek.length > 0) {
      frequencyConfig.days_of_week = daysOfWeek;
    }
  }

  const habit = HabitEntity.create(name, frequencyType, frequencyConfig, {
    description: description || undefined,
  });

  const result = await HabitRepository.save(habit);

  if (result.isErr()) {
    return data({ error: "Failed to create habit" }, { status: 500 });
  }

  return redirect("/habits");
}

export default function NewHabit() {
  const actionData = useActionData<typeof action>();
  const [frequencyType, setFrequencyType] = React.useState<string>("daily");

  const daysOfWeek = [
    { value: "Sunday", label: "Sunday" },
    { value: "Monday", label: "Monday" },
    { value: "Tuesday", label: "Tuesday" },
    { value: "Wednesday", label: "Wednesday" },
    { value: "Thursday", label: "Thursday" },
    { value: "Friday", label: "Friday" },
    { value: "Saturday", label: "Saturday" },
  ];

  return (
    <Box>
      <Flex justify="between" align="center" mb="6">
        <Heading size="7">Create New Habit</Heading>
      </Flex>

      {"error" in (actionData ?? {}) && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{(actionData as { error: string }).error}</Callout.Text>
        </Callout.Root>
      )}

      <Form method="post">
        <Flex direction="column" gap="4">
          <Box>
            <Text
              as="label"
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Name
            </Text>
            <TextField.Root
              name="name"
              required
              placeholder="e.g., Go to gym"
            />
          </Box>

          <Box>
            <Text
              as="label"
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Description (optional)
            </Text>
            <TextArea
              name="description"
              placeholder="e.g., Weight training and cardio"
              rows={3}
            />
          </Box>

          <Box>
            <Text
              as="label"
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Frequency
            </Text>
            <Select.Root
              name="frequencyType"
              value={frequencyType}
              onValueChange={setFrequencyType}
              required
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="daily">Daily</Select.Item>
                <Select.Item value="weekly">Weekly (specific days)</Select.Item>
                <Select.Item value="monthly">Monthly</Select.Item>
                <Select.Item value="custom">Custom</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          {(frequencyType === "weekly" || frequencyType === "custom") && (
            <Box>
              <Text
                size="2"
                weight="medium"
                mb="3"
                style={{ display: "block" }}
              >
                Days of the Week
              </Text>
              <Grid columns="2" gap="2">
                {daysOfWeek.map((day) => (
                  <Text as="label" key={day.value} size="2">
                    <Flex gap="2" align="center">
                      <Checkbox name="daysOfWeek" value={day.value} />
                      {day.label}
                    </Flex>
                  </Text>
                ))}
              </Grid>
            </Box>
          )}

          <Flex gap="3" mt="4">
            <Button asChild variant="soft" color="gray">
              <Link to="/habits">Cancel</Link>
            </Button>
            <Button type="submit">Create Habit</Button>
          </Flex>
        </Flex>
      </Form>
    </Box>
  );
}
