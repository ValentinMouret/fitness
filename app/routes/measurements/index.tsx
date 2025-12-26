import { Link } from "react-router";
import {
  Box,
  Heading,
  Text,
  Flex,
  Card,
  Grid,
  Badge,
  Button,
} from "@radix-ui/themes";
import { RulerSquareIcon } from "@radix-ui/react-icons";
import { MeasurementRepository } from "~/modules/core/infra/measurements.repository.server";
import { MeasureRepository } from "~/modules/core/infra/measure.repository.server";
import { handleResultError } from "~/utils/errors";
import type { Route } from "./+types/index";

export async function loader() {
  const measurements = await MeasurementRepository.fetchAll();

  if (measurements.isErr()) {
    handleResultError(measurements, "Failed to load measurements");
  }

  const measurementsWithLatest = await Promise.all(
    measurements.value.map(async (measurement) => {
      const latestMeasures = await MeasureRepository.fetchByMeasurementName(
        measurement.name,
        1,
      );

      return {
        ...measurement,
        latestValue:
          latestMeasures.isOk() && latestMeasures.value.length > 0
            ? latestMeasures.value[0]
            : null,
      };
    }),
  );

  return {
    measurements: measurementsWithLatest,
  };
}

export default function MeasurementsPage({ loaderData }: Route.ComponentProps) {
  const { measurements } = loaderData;

  return (
    <Box>
      <Flex justify="between" align="center" mb="6">
        <Heading size="7">Measurements</Heading>
        <Button asChild>
          <Link to="/measurements/new">New Measurement</Link>
        </Button>
      </Flex>

      {measurements.length === 0 ? (
        <Card size="4" style={{ textAlign: "center" }}>
          <Text size="6" mb="4">
            📏
          </Text>
          <Heading size="4" mb="2">
            No measurements configured
          </Heading>
          <Text color="gray" mb="4">
            Measurements help you track various health metrics over time.
          </Text>
        </Card>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
          {measurements.map((measurement) => (
            <Card key={measurement.name} size="3" asChild>
              <Link
                to={`/measurements/${measurement.name}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="start">
                    <Flex align="center" gap="2">
                      <RulerSquareIcon />
                      <Heading size="4" style={{ textTransform: "capitalize" }}>
                        {measurement.name.replace(/_/g, " ")}
                      </Heading>
                    </Flex>
                    <Badge variant="soft" color="gray">
                      {measurement.unit}
                    </Badge>
                  </Flex>

                  {measurement.description && (
                    <Text color="gray" size="2">
                      {measurement.description}
                    </Text>
                  )}

                  {measurement.latestValue ? (
                    <Flex direction="column" gap="1">
                      <Text size="3" weight="medium">
                        {measurement.latestValue.value} {measurement.unit}
                      </Text>
                      <Text size="1" color="gray">
                        {measurement.latestValue.t.toLocaleDateString()}
                      </Text>
                    </Flex>
                  ) : (
                    <Text size="2" color="gray" style={{ fontStyle: "italic" }}>
                      No measurements recorded
                    </Text>
                  )}
                </Flex>
              </Link>
            </Card>
          ))}
        </Grid>
      )}
    </Box>
  );
}
