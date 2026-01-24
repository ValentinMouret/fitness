import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DataList,
  Flex,
  Grid,
  Heading,
  IconButton,
} from "@radix-ui/themes";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import MaintenanceForm from "../MaintenanceForm";
import type { Route } from "./+types";
import { coerceFloat, coerceInt, expect } from "~/utils";
import { Result } from "neverthrow";
import { NutritionCalculationService } from "~/modules/nutrition/domain/nutrition-calculation-service";
import { Age, Height, Weight } from "~/modules/core/domain/measurements";
import { Activity } from "~/modules/nutrition/domain/activity";
import MacrosChart from "~/components/MacrosChart";
import { Form, Link } from "react-router";
import { useState } from "react";
import { Target } from "~/modules/core/domain/target";
import { baseMeasurements } from "~/modules/core/domain/measurements";
import { TargetService } from "~/modules/core/application/measurement-service";

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
      const maintenance = NutritionCalculationService.mifflinStJeor({
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
        macrosSplit: NutritionCalculationService.macrosSplit({
          calories: target,
          weight: w,
        }),
      };
    })
    .unwrapOr(undefined);
}

export default function CalculateTargetsPage({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const [modalClosed, setModalClosed] = useState(false);

  return (
    <>
      <Flex align="center" gap="4" mb="6">
        <IconButton asChild size="3" variant="ghost">
          <Link to="/nutrition">
            <ArrowLeftIcon />
          </Link>
        </IconButton>
        <Heading size="7">Calculate Targets</Heading>
      </Flex>

      <MaintenanceForm
        age={loaderData?.age}
        height={loaderData?.height}
        weight={loaderData?.weight}
        activity={loaderData?.activity}
        delta={loaderData?.delta}
      />

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
    </>
  );
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  const age = coerceInt(expect(form.get("age")?.toString()));
  const height = coerceInt(expect(form.get("height")?.toString()));
  const weight = coerceInt(expect(form.get("weight")?.toString()));
  const activity = coerceFloat(expect(form.get("activity")?.toString()));
  const delta = coerceInt(expect(form.get("delta")?.toString()));

  const result = Result.combine([age, height, weight, activity, delta]);

  if (result.isErr()) {
    throw new Error(result.error);
  }

  const [a, h, w, act, d] = result.value;

  const maintenance = NutritionCalculationService.mifflinStJeor({
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

  const saveResult = await TargetService.setTarget(target);

  if (saveResult.isErr()) {
    throw new Error(saveResult.error);
  }

  return { success: true };
}
