import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  IconButton,
  Kbd,
  Table,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { useEffect, useId, useRef } from "react";
import { data, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import MeasurementChart from "~/components/MeasurementChart";
import { NumberInput } from "~/components/NumberInput";
import { SectionHeader } from "~/components/SectionHeader";
import {
  addMeasure,
  deleteMeasure,
  getMeasurementDetail,
} from "~/modules/core/infra/measurement-detail.service.server";
import { today } from "~/time";
import { formNumber, formOptionalText } from "~/utils/form-data";
import type { Route } from "./+types/:name";
import "./measurement-detail.css";

export async function loader({ params }: Route.LoaderArgs) {
  const { name } = params;
  return getMeasurementDetail(name);
}

export const handle = {
  header: (data: Route.ComponentProps["loaderData"]) => {
    const displayName = data.measurement.name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    return {
      title: displayName,
      backTo: "/measurements",
    };
  },
};

export async function action({ request, params }: Route.ActionArgs) {
  const { name } = params;
  const formData = await request.formData();
  const intentSchema = zfd.formData({
    intent: formOptionalText(),
  });
  const intentParsed = intentSchema.parse(formData);
  const intent = intentParsed.intent;

  if (intent === "add-measure") {
    const schema = zfd.formData({
      value: formNumber(z.number()),
      date: formOptionalText(),
    });
    const parsed = schema.safeParse(formData);
    if (!parsed.success) {
      return data({ error: "Invalid value" }, { status: 400 });
    }

    const measureDate = parsed.data.date ? new Date(parsed.data.date) : today();
    const result = await addMeasure({
      name,
      value: parsed.data.value,
      date: measureDate,
    });

    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }

    return data({ success: true });
  }

  if (intent === "delete-measure") {
    const schema = zfd.formData({
      date: formOptionalText(),
    });
    const parsed = schema.parse(formData);
    const measureDate = parsed.date ? new Date(parsed.date) : new Date();

    const result = await deleteMeasure({ name, date: measureDate });
    if (!result.ok) {
      return data({ error: result.error }, { status: result.status });
    }

    return data({ success: true });
  }

  return null;
}

export default function MeasurementPage({
  loaderData: { measurement, measures },
}: Route.ComponentProps) {
  const fetcher = useFetcher();
  const addFetcher = useFetcher();
  const valueInputId = useId();
  const dateInputId = useId();
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key.toLowerCase() === "m" && valueInputRef.current) {
        e.preventDefault();
        valueInputRef.current.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isSubmitting = addFetcher.state === "submitting";
  const actionData = z
    .object({ error: z.string().optional(), success: z.boolean().optional() })
    .nullable()
    .parse(addFetcher.data);

  return (
    <Box>
      {measurement.description && (
        <Text as="div" color="gray" mb="4">
          {measurement.description}
        </Text>
      )}

      {actionData?.error && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{actionData.error}</Callout.Text>
        </Callout.Root>
      )}

      {actionData?.success && (
        <Callout.Root color="green" mb="4">
          <Callout.Text>Measurement saved successfully!</Callout.Text>
        </Callout.Root>
      )}

      <Card size="3" mb="6">
        <SectionHeader
          title={
            <Flex align="center" gap="2">
              <Text>Add New Measurement</Text>
              <Box display={{ initial: "none", md: "inline-block" }}>
                <Kbd size="1">M</Kbd>
              </Box>
            </Flex>
          }
        />
        <addFetcher.Form method="post">
          <input type="hidden" name="intent" value="add-measure" />
          <Flex gap="3" align="end" wrap="wrap">
            <Box>
              <Text
                as="label"
                htmlFor={valueInputId}
                size="2"
                mb="1"
                style={{ display: "block" }}
              >
                Value ({measurement.unit})
              </Text>
              <NumberInput
                ref={valueInputRef}
                id={valueInputId}
                name="value"
                placeholder="Enter value"
                required
                disabled={isSubmitting}
                aria-keyshortcuts="m"
              />
            </Box>
            <Box>
              <Text
                as="label"
                htmlFor={dateInputId}
                size="2"
                mb="1"
                style={{ display: "block" }}
              >
                Date
              </Text>
              <TextField.Root
                id={dateInputId}
                name="date"
                type="date"
                defaultValue={today().toISOString().split("T")[0]}
                disabled={isSubmitting}
              />
            </Box>
            <Tooltip content="Log measurement (Enter)">
              <Button type="submit" loading={isSubmitting}>
                <PlusIcon />
                Add Measurement
              </Button>
            </Tooltip>
          </Flex>
        </addFetcher.Form>
      </Card>

      {measures.length > 0 && (
        <Card size="3" mb="6">
          <MeasurementChart
            data={measures}
            unit={measurement.unit}
            measurementName={measurement.name}
          />
        </Card>
      )}

      <Card size="3">
        <SectionHeader title="Measurement History" />
        {measures.length === 0 ? (
          <Text color="gray" className="measurement-detail__empty-state">
            No measurements recorded yet. Add your first measurement above.
          </Text>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Value</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {measures.map((measure) => (
                <Table.Row key={measure.t.toISOString()}>
                  <Table.Cell>{measure.t.toLocaleDateString()}</Table.Cell>
                  <Table.Cell>
                    {measure.value} {measurement.unit}
                  </Table.Cell>
                  <Table.Cell>
                    <AlertDialog.Root>
                      <Tooltip content="Delete measurement">
                        <AlertDialog.Trigger>
                          <IconButton
                            variant="ghost"
                            color="red"
                            size="1"
                            aria-label="Delete measurement"
                          >
                            <TrashIcon />
                          </IconButton>
                        </AlertDialog.Trigger>
                      </Tooltip>
                      <AlertDialog.Content maxWidth="450px">
                        <AlertDialog.Title>
                          Delete Measurement
                        </AlertDialog.Title>
                        <AlertDialog.Description size="2">
                          Are you sure you want to delete this measurement from{" "}
                          {measure.t.toLocaleDateString()}? This action cannot
                          be undone.
                        </AlertDialog.Description>

                        <Flex gap="3" mt="4" justify="end">
                          <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">
                              Cancel
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <fetcher.Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="delete-measure"
                              />
                              <input
                                type="hidden"
                                name="date"
                                value={measure.t.toISOString()}
                              />
                              <Button variant="solid" color="red" type="submit">
                                Delete
                              </Button>
                            </fetcher.Form>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </Box>
  );
}
