import { Link } from "react-router";
import { Box, Heading, Text, Flex, Card, Grid, Badge } from "@radix-ui/themes";
import { RulerSquareIcon } from "@radix-ui/react-icons";
import { EmptyState } from "~/components/EmptyState";
import { getMeasurementsPageData } from "~/modules/core/application/measurements-page.service.server";
import type { Route } from "./+types/index";

export async function loader() {
  return getMeasurementsPageData();
}

export const handle = {
  header: () => ({
    title: "Measurements",
    primaryAction: {
      label: "New Measurement",
      to: "/measurements/new",
    },
  }),
};

export default function MeasurementsPage({ loaderData }: Route.ComponentProps) {
  const { measurements } = loaderData;

  return (
    <Box>
      {measurements.length === 0 ? (
        <EmptyState
          icon="📏"
          title="No measurements configured"
          description="Measurements help you track various health metrics over time."
          actionLabel="Add Measurement"
          actionTo="/measurements/new"
        />
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
