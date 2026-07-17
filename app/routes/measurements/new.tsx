import {
  Box,
  Button,
  Callout,
  Flex,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useId, useRef } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import RequiredStar from "~/components/RequiredStar";
import { createMeasurement } from "~/modules/core/infra/create-measurement.service.server";
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
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const nameId = useId();
  const unitId = useId();
  const descriptionId = useId();

  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Box>
      {actionData && "error" in actionData && (
        <Callout.Root color="red" mb="4" role="alert">
          <Callout.Text>{actionData.error}</Callout.Text>
        </Callout.Root>
      )}

      <Form ref={formRef} method="post">
        <Flex direction="column" gap="4">
          <Box>
            <Text
              as="label"
              htmlFor={nameId}
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Name <RequiredStar />
            </Text>
            <TextField.Root
              ref={nameInputRef}
              id={nameId}
              name="name"
              required
              disabled={isSubmitting}
              placeholder="e.g., Body Fat Percentage"
            />
            <Text size="1" color="gray" mt="1">
              Will be converted to snake_case (e.g., "body_fat_percentage")
            </Text>
          </Box>

          <Box>
            <Text
              as="label"
              htmlFor={unitId}
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Unit <RequiredStar />
            </Text>
            <TextField.Root
              id={unitId}
              name="unit"
              required
              disabled={isSubmitting}
              placeholder="e.g., %, kg, cm"
            />
          </Box>

          <Box>
            <Text
              as="label"
              htmlFor={descriptionId}
              size="2"
              weight="medium"
              mb="2"
              style={{ display: "block" }}
            >
              Description (optional)
            </Text>
            <TextArea
              id={descriptionId}
              name="description"
              disabled={isSubmitting}
              placeholder="e.g., Body fat measured with calipers"
              rows={3}
            />
          </Box>

          <Flex gap="3" mt="4">
            <Button asChild variant="soft" color="gray" disabled={isSubmitting}>
              <Link to="/measurements">Cancel</Link>
            </Button>
            <Tooltip content="Create measurement (Cmd+Enter)">
              <Box display="inline-block">
                <Button
                  type="submit"
                  loading={isSubmitting}
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  Create Measurement
                </Button>
              </Box>
            </Tooltip>
          </Flex>
        </Flex>
      </Form>
    </Box>
  );
}
