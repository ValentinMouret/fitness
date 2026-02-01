import { Form, redirect, useActionData, Link } from "react-router";
import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/edit";
import {
  getHabitForEdit,
  updateHabit,
} from "../../modules/habits/application/edit-habit.service.server";
import * as React from "react";
import { allDays } from "~/time";
import { zfd } from "zod-form-data";
import {
  formOptionalText,
  formRepeatableText,
  formText,
} from "~/utils/form-data";
import {
  Box,
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
  const habit = await getHabitForEdit(params.id);
  return data({ habit });
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();

  const schema = zfd.formData({
    name: formText(z.string().min(1)),
    description: formOptionalText(),
    frequencyType: formText(z.enum(["daily", "weekly", "monthly", "custom"])),
    daysOfWeek: formRepeatableText(),
  });
  const parsed = schema.parse(formData);

  const frequencyConfig: {
    days_of_week?: string[];
    interval_days?: number;
    day_of_month?: number;
  } = {};
  if (parsed.frequencyType === "custom" || parsed.frequencyType === "weekly") {
    if (parsed.daysOfWeek.length > 0) {
      frequencyConfig.days_of_week = parsed.daysOfWeek;
    }
  }

  const result = await updateHabit({
    id: params.id,
    name: parsed.name,
    description: parsed.description || undefined,
    frequencyType: parsed.frequencyType,
    frequencyConfig,
  });

  if (!result.ok) {
    return data({ error: result.error }, { status: result.status });
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
