import { Form, redirect, useActionData, Link } from "react-router";
import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/edit";
import type {
  Habit as HabitEntity,
  Habit,
} from "../../modules/habits/domain/entity";
import { HabitRepository } from "../../modules/habits/infra/repository.server";
import * as React from "react";
import { allDays } from "~/time";
import {
  Box,
  Heading,
  TextField,
  TextArea,
  Select,
  Button,
  Text,
  Flex,
  Callout,
  Checkbox,
  Grid,
} from "@radix-ui/themes";

export const handle = {
  header: () => ({
    title: "Edit Habit",
    backTo: "/habits",
  }),
};

export async function loader({ params }: Route.LoaderArgs) {
  const result = await HabitRepository.fetchById(params.id);

  if (result.isErr()) {
    throw data({ error: "Habit not found" }, { status: 404 });
  }

  return data({ habit: result.value });
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  const name = formData.get("name")?.toString() ?? "";
  const description = formData.get("description")?.toString();
  const frequencyType = z
    .enum(["daily", "weekly", "monthly", "custom"])
    .parse(formData.get("frequencyType"));

  const frequencyConfig: {
    days_of_week?: string[];
    interval_days?: number;
    day_of_month?: number;
  } = {};
  if (frequencyType === "custom" || frequencyType === "weekly") {
    const daysOfWeek = formData.getAll("daysOfWeek").map((s) => s.toString());
    if (daysOfWeek.length > 0) {
      frequencyConfig.days_of_week = daysOfWeek;
    }
  }

  const existingHabit = await HabitRepository.fetchById(params.id);
  if (existingHabit.isErr()) {
    return data({ error: "Habit not found" }, { status: 404 });
  }

  const updatedHabit: Habit = {
    ...existingHabit.value,
    name,
    description: description || undefined,
    frequencyType,
    frequencyConfig,
  };

  const result = await HabitRepository.save(updatedHabit);

  if (result.isErr()) {
    return data({ error: "Failed to update habit" }, { status: 500 });
  }

  return redirect("/habits");
}

export default function EditHabit({
  loaderData: { habit },
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const [frequencyType, setFrequencyType] = React.useState<string>(
    habit.frequencyType,
  );

  return (
    <Box>
      {actionData && "error" in actionData && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{actionData.error}</Callout.Text>
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
              defaultValue={habit.name}
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
              defaultValue={habit.description}
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
                {allDays.map((day) => (
                  <Text as="label" key={day} size="2">
                    <Flex gap="2" align="center">
                      <Checkbox
                        name="daysOfWeek"
                        value={day}
                        defaultChecked={habit.frequencyConfig.days_of_week?.includes(
                          day,
                        )}
                      />
                      {day}
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
            <Button type="submit">Save Changes</Button>
          </Flex>
        </Flex>
      </Form>
    </Box>
  );
}
