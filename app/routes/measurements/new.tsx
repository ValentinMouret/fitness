import { Form, redirect, useActionData, Link } from "react-router";
import { data } from "react-router";
import type { Route } from "./+types/new";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import {
  Box,
  Heading,
  TextField,
  TextArea,
  Button,
  Text,
  Flex,
  Callout,
} from "@radix-ui/themes";

function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export const handle = {
  header: () => ({
    title: "New Measurement",
    backTo: "/measurements",
  }),
};

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const rawName = formData.get("name")?.toString();
  const unit = formData.get("unit")?.toString();
  const description = formData.get("description")?.toString();

  if (!rawName || !unit) {
    return data({ error: "Name and unit are required" }, { status: 400 });
  }

  const name = toSnakeCase(rawName);

  if (!name) {
    return data(
      { error: "Name must contain at least one alphanumeric character" },
      { status: 400 },
    );
  }

  const result = await MeasurementRepository.save({
    name,
    unit: unit.trim(),
    description: description?.trim() || undefined,
  });

  if (result.isErr()) {
    return data({ error: "Failed to create measurement" }, { status: 500 });
  }

  return redirect("/measurements");
}

export default function NewMeasurement() {
  const actionData = useActionData<typeof action>();

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
              placeholder="e.g., Body Fat Percentage"
            />
            <Text size="1" color="gray" mt="1">
              Will be converted to snake_case (e.g., "body_fat_percentage")
            </Text>
          </Box>

          <Box>
            <Text
              as="label"
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Unit
            </Text>
            <TextField.Root
              name="unit"
              required
              placeholder="e.g., %, kg, cm"
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
              placeholder="e.g., Body fat measured with calipers"
              rows={3}
            />
          </Box>

          <Flex gap="3" mt="4">
            <Button asChild variant="soft" color="gray">
              <Link to="/measurements">Cancel</Link>
            </Button>
            <Button type="submit">Create Measurement</Button>
          </Flex>
        </Flex>
      </Form>
    </Box>
  );
}
