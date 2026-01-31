import { data, useFetcher, useLoaderData } from "react-router";
import { z } from "zod";
import { SectionHeader } from "~/components/SectionHeader";
import {
  Box,
  Text,
  Flex,
  Card,
  Button,
  Table,
  TextField,
  Callout,
  AlertDialog,
  IconButton,
} from "@radix-ui/themes";
import { NumberInput } from "~/components/NumberInput";
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import { MeasureRepository } from "~/modules/core/infra/measure.repository.server";
import { Measure } from "~/modules/core/domain/measure";
import { handleResultError } from "~/utils/errors";
import { today } from "~/time";
import MeasurementChart from "~/components/MeasurementChart";
import type { Route } from "./+types/name";

export async function loader({ params }: Route.LoaderArgs) {
  const { name } = params;

  const measurement = await MeasurementRepository.fetchByName(name);
  if (measurement.isErr()) {
    handleResultError(measurement, "Failed to load measurement");
  }

  const measures = await MeasureRepository.fetchAll(name);
  if (measures.isErr()) {
    handleResultError(measures, "Failed to load measures");
  }

  return {
    measurement: measurement.value,
    measures: measures.value,
  };
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
  const intent = formData.get("intent");

  if (intent === "add-measure") {
    const value = Number(formData.get("value"));
    const dateStr = formData.get("date")?.toString();

    if (Number.isNaN(value)) {
      return data({ error: "Invalid value" }, { status: 400 });
    }

    const measureDate = dateStr ? new Date(dateStr) : today();
    const measure = Measure.create(name, value, measureDate);

    const result = await MeasureRepository.save(measure);
    if (result.isErr()) {
      return data({ error: "Failed to save measure" }, { status: 500 });
    }

    return data({ success: true });
  }

  if (intent === "delete-measure") {
    const dateStr = formData.get("date")?.toString();
    const measureDate = dateStr ? new Date(dateStr) : new Date();

    const result = await MeasureRepository.delete(name, measureDate);
    if (result.isErr()) {
      return data({ error: "Failed to delete measure" }, { status: 500 });
    }

    return data({ success: true });
  }

  return null;
}

export default function MeasurementPage(_: Route.ComponentProps) {
  const { measurement, measures } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const addFetcher = useFetcher();

  const isSubmitting = addFetcher.state === "submitting";
  const actionData = z
    .object({ error: z.string().optional(), success: z.boolean().optional() })
    .nullable()
    .parse(addFetcher.data);

  return (
    <Box>
      {measurement.description && (
        <Text color="gray" mb="4" style={{ display: "block" }}>
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
        <SectionHeader title="Add New Measurement" />
        <addFetcher.Form method="post">
          <input type="hidden" name="intent" value="add-measure" />
          <Flex gap="3" align="end" wrap="wrap">
            <Box>
              <Text size="2" mb="1" style={{ display: "block" }}>
                Value ({measurement.unit})
              </Text>
              <NumberInput
                name="value"
                placeholder="Enter value"
                required
                disabled={isSubmitting}
              />
            </Box>
            <Box>
              <Text size="2" mb="1" style={{ display: "block" }}>
                Date
              </Text>
              <TextField.Root
                name="date"
                type="date"
                defaultValue={today().toISOString().split("T")[0]}
                disabled={isSubmitting}
              />
            </Box>
            <Button type="submit" disabled={isSubmitting}>
              <PlusIcon />
              Add Measurement
            </Button>
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
          <Text
            color="gray"
            style={{ textAlign: "center", display: "block", padding: "2rem" }}
          >
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
                      <AlertDialog.Trigger>
                        <IconButton variant="ghost" color="red" size="1">
                          <TrashIcon />
                        </IconButton>
                      </AlertDialog.Trigger>
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
