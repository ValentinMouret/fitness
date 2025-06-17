import { ok, ResultAsync } from "neverthrow";
import {
  Measure,
  MeasurementRepository,
  MeasurementService,
  MeasureRepository,
} from "~/measurements";
import { isSameDay } from "~/time";
import type { Route } from "./+types/index";
import { Form } from "react-router";
import { coerceFloat, resultFromNullable } from "~/utils";

export async function loader() {
  const now = new Date();

  const result = await ResultAsync.combine([
    MeasureRepository.fetchByMeasurementName("weight", 1),
    MeasurementRepository.fetchByName("weight"),
    MeasurementService.fetchStreak("weight"),
  ]).map(([weights, weight, streak]) => ({
    weight,
    streak,
    lastWeight: weights?.[0],
    loggedToday: weights?.[0] && isSameDay(weights?.[0].t, now),
  }));

  if (result.isOk()) {
    return result.value;
  }

  throw new Response(result.error, {
    status: 500,
    statusText: "Failed to fetch weight data",
  });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const result = await resultFromNullable(
    form.get("weight")?.toString(),
    "validation_error",
  )
    .andThen(coerceFloat)
    .asyncMap(async (weight) =>
      MeasureRepository.save(Measure.create("weight", weight)),
    );

  if (result.isErr()) {
    throw new Response(result.error, {
      status: 500,
      statusText: "Failed to save weight",
    });
  }
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { weight, lastWeight, loggedToday, streak } = loaderData;

  return (
    <div>
      <h1>Today</h1>
      {loggedToday ? (
        <>
          <p>
            Weight: {lastWeight.value}
            {weight.unit}
          </p>
          <p>Streak: {streak} days</p>
        </>
      ) : (
        <Form method="post">
          <p>You have not logged today’s weight</p>
          <label>Weight:</label>
          <input id="weight" name="weight" type="number" min={0} step={0.1} />
          <br />
          <button type="submit">Submit</button>
        </Form>
      )}
    </div>
  );
}
