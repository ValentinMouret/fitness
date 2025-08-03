import { Container, Flex, Heading, Link as RadixLink } from "@radix-ui/themes";
import { TargetService } from "~/modules/core/application/measurement-service";
import type { Route } from "./+types";
import { Link as RouterLink } from "react-router";
import { baseMeasurements } from "~/modules/core/domain/measurements";

export async function loader() {
  const activeTargets = await TargetService.currentTargets();

  if (activeTargets.isErr()) {
    throw new Error(activeTargets.error);
  }

  const dailyCalorieIntake = activeTargets.value.find(
    (t) => t.measurement === baseMeasurements.dailyCalorieIntake.name,
  );

  if (!dailyCalorieIntake) {
    return undefined;
  }

  return {
    dailyCalorieIntake,
  };
}

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  return (
    <Container size="3" p="6">
      <Heading size="8" mb="6">
        Nutrition
      </Heading>

      {loaderData?.dailyCalorieIntake ? (
        <div>
          <p>
            Current calorie target: {loaderData.dailyCalorieIntake.value}{" "}
            Cal/day
          </p>
        </div>
      ) : null}

      <Flex direction="column" gap="3" mt="4">
        <RadixLink asChild>
          <RouterLink to="/nutrition/calculate-targets">
            Calculate targets
          </RouterLink>
        </RadixLink>

        <RadixLink asChild>
          <RouterLink to="/nutrition/meal-builder">Meal Builder</RouterLink>
        </RadixLink>
      </Flex>
    </Container>
  );
}
