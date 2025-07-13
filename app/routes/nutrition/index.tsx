import {
  AlertDialog,
  Badge,
  Button,
  Card,
  Container,
  DataList,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Result } from "neverthrow";
import { useState } from "react";
import { Form } from "react-router";
import MacrosChart from "~/components/MacrosChart";
import { Age, Height, Weight } from "~/modules/core/domain/measurements";
import { Activity } from "~/modules/nutrition/domain/activity";
import { NutritionService } from "~/modules/nutrition/domain/nutrition-service";
import { coerceFloat, coerceInt, expect } from "~/utils";
import type { Route } from "./+types";
import { Target } from "~/modules/core/domain/target";
import { baseMeasurements, type Measurement } from "~/measurements";
import { TargetService } from "~/modules/nutrition/application/service";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (searchParams.size === 0) {
    return undefined;
  }

  const age = coerceInt(expect(searchParams.get("age")));
  const height = coerceInt(expect(searchParams.get("height")));
  const weight = coerceInt(expect(searchParams.get("weight")));
  const activity = coerceFloat(expect(searchParams.get("activity")));
  const delta = coerceInt(expect(searchParams.get("delta")));

  return Result.combine([age, height, weight, activity, delta])
    .map(([a, h, w, act, d]) => {
      const maintenance = NutritionService.mifflinStJeor({
        age: Age.years(a),
        height: Height.cm(h),
        weight: Weight.kg(w),
        activity: Activity.ratio(act),
      });
      const target = Math.round((1 + d / 100) * maintenance);
      return {
        age: a,
        height: h,
        weight: w,
        activity: act,
        delta: d,
        maintenance,
        target,
        macrosSplit: NutritionService.macrosSplit({
          calories: target,
          weight: w,
        }),
      };
    })
    .unwrapOr(undefined);
}

export default function NutritionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [modalClosed, setModalClosed] = useState(false);

  return (
    <Container size="3" p="6">
      <Heading size="8" mb="6">
        Nutrition
      </Heading>

      <Card size="3" mb="6">
        <Heading size="5" mb="4">
          Calculate Maintenance Calories
        </Heading>

        <Form>
          <Flex direction="column" gap="4">
            <Flex direction="column" gap="2">
              <Text as="label" size="2" weight="medium">
                Age
              </Text>
              <TextField.Root
                name="age"
                type="number"
                defaultValue={loaderData?.age ?? 30}
                min={10}
                step={1}
                placeholder="30"
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text as="label" size="2" weight="medium">
                Height (cm)
              </Text>
              <TextField.Root
                name="height"
                type="number"
                defaultValue={loaderData?.height ?? 180}
                min={0}
                step={1}
                placeholder="180"
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text as="label" size="2" weight="medium">
                Weight (kg)
              </Text>
              <TextField.Root
                name="weight"
                type="number"
                defaultValue={loaderData?.weight ?? 70}
                min={0}
                step={1}
                placeholder="70"
              />
            </Flex>

            <Flex direction="column" gap="2">
              <Text as="label" size="2" weight="medium">
                Activity Level
              </Text>
              <TextField.Root
                name="activity"
                type="number"
                defaultValue={loaderData?.activity ?? 1.4}
                step={0.1}
                min={0.8}
                max={2.0}
                placeholder="1.4"
              />
              <Text size="1" color="gray">
                Sedentary: 1.2 • Light activity: 1.4 • Moderate: 1.6 • Very
                active: 1.8
              </Text>
            </Flex>

            <Flex direction="column" gap="2">
              <Text as="label" size="2" weight="medium">
                Target Deficit/Surplus (%)
              </Text>
              <TextField.Root
                name="delta"
                type="number"
                defaultValue={loaderData?.delta ?? 0}
                min={-15}
                max={15}
                step={1}
                placeholder="0"
              />
              <Text size="1" color="gray">
                Negative for weight loss (e.g., -10%), positive for weight gain
              </Text>
            </Flex>

            <Button type="submit" size="3" mt="2">
              Calculate
            </Button>
          </Flex>
        </Form>
      </Card>

      {loaderData?.maintenance && (
        <>
          <Grid columns={{ initial: "1", md: "2" }} gap="6">
            <Card size="3">
              <Heading size="4" mb="3">
                Results
              </Heading>
              <DataList.Root>
                <DataList.Item align="center">
                  <DataList.Label minWidth="88px">Maintenance</DataList.Label>
                  <DataList.Value>
                    <Badge size="2" color="blue">
                      {Math.round(loaderData.maintenance)} kcal/day
                    </Badge>
                  </DataList.Value>
                </DataList.Item>

                <DataList.Item>
                  <DataList.Label minWidth="88px">Target</DataList.Label>
                  <DataList.Value>
                    <Badge size="2" color="green">
                      {loaderData.target} kcal/day
                    </Badge>
                  </DataList.Value>
                </DataList.Item>
              </DataList.Root>
            </Card>

            <Card size="3">
              <Heading size="4" mb="3">
                Macros Split
              </Heading>
              <MacrosChart macrosSplit={loaderData.macrosSplit} />
            </Card>
          </Grid>

          <Flex justify={"center"} mt={"2"}>
            <Form method="post">
              <input
                name="age"
                type="number"
                defaultValue={loaderData?.age ?? 30}
                min={10}
                step={1}
                placeholder="30"
                readOnly
                hidden
              />
              <input
                name="height"
                type="number"
                defaultValue={loaderData?.height ?? 180}
                min={0}
                step={1}
                placeholder="180"
                readOnly
                hidden
              />
              <input
                name="weight"
                type="number"
                defaultValue={loaderData?.weight ?? 70}
                min={0}
                step={1}
                placeholder="70"
                readOnly
                hidden
              />

              <input
                name="activity"
                type="number"
                defaultValue={loaderData?.activity ?? 1.4}
                step={0.1}
                min={0.8}
                max={2.0}
                placeholder="1.4"
                readOnly
                hidden
              />
              <input
                name="delta"
                type="number"
                defaultValue={loaderData?.delta ?? 0}
                min={-15}
                max={15}
                step={1}
                placeholder="0"
                readOnly
                hidden
              />
              <Button type={"submit"} size={"3"} mt={"2"}>
                Save plan
              </Button>
            </Form>
          </Flex>
        </>
      )}

      <AlertDialog.Root
        open={!!actionData?.success && !modalClosed}
        onOpenChange={(open) => !open && setModalClosed(true)}
      >
        <AlertDialog.Content>
          <AlertDialog.Title>Success!</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Your nutrition target has been saved successfully.
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Close
              </Button>
            </AlertDialog.Cancel>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Container>
  );
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  const age = coerceInt(expect(form.get("age")?.toString()));
  const height = coerceInt(expect(form.get("height")?.toString()));
  const weight = coerceInt(expect(form.get("weight")?.toString()));
  const activity = coerceFloat(expect(form.get("activity")?.toString()));
  const delta = coerceInt(expect(form.get("delta")?.toString()));

  const result = Result.combine([age, height, weight, activity, delta]).map(
    ([a, h, w, act, d]) => {
      const maintenance = NutritionService.mifflinStJeor({
        age: Age.years(a),
        height: Height.cm(h),
        weight: Weight.kg(w),
        activity: Activity.ratio(act),
      });
      const targetIntake = Math.round((1 + d / 100) * maintenance);

      const target = Target.create({
        measurement: baseMeasurements.dailyCalorieIntake.name,
        value: targetIntake,
      });
      return TargetService.setTarget(target);
    },
  );

  if (result.isErr()) {
    throw new Error(result.error);
  }

  return { success: true };
}
