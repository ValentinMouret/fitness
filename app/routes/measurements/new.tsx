import {
  Box,
  Button,
  Callout,
  Flex,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { data, Form, Link, redirect, useActionData } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { createMeasurement } from "~/modules/core/application/create-measurement.service.server";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/new";

export const handle = {
  header: () => ({
    title: "New Measurement",
    backTo: "/measurements",
  }),
};

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const schema = zfd.formData({
    name: formText(z.string().min(1)),
    unit: formText(z.string().min(1)),
    description: formOptionalText(),
  });

  const parsed = schema.parse(formData);

  const result = await createMeasurement({
    rawName: parsed.name,
    unit: parsed.unit,
    description: parsed.description ?? undefined,
  });

  if (!result.ok) {
    return data({ error: result.error }, { status: result.status });
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
