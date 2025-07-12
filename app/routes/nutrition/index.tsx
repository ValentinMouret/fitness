import { Form } from "react-router";
import type { Route } from "./+types";
import { coerceFloat, coerceInt, expect } from "~/utils";
import { Result } from "neverthrow";

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
      const maintenance = act * (10 * w + 6.5 * h - 5 * a + 5);
      const target = ((1 + d / 100) * maintenance).toFixed();
      return {
        age: a,
        height: h,
        weight: w,
        activity: act,
        delta: d,
        maintenance,
        target,
      };
    })
    .unwrapOr(undefined);
}

export default function NutritionPage({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Nutrition</h1>

      <h2>Maintenance</h2>
      <Form style={{ display: "flex", flexDirection: "column" }}>
        <fieldset>
          <label>Age</label>
          <input
            name="age"
            type="number"
            defaultValue={loaderData?.age ?? 30}
            min={10}
            step={1}
          />
        </fieldset>

        <fieldset>
          <label>Height</label>
          <input
            name="height"
            type="number"
            defaultValue={loaderData?.height ?? 180}
            min={0}
            step={1}
          />
        </fieldset>

        <fieldset>
          <label>Weight</label>
          <input
            name="weight"
            type="number"
            defaultValue={loaderData?.weight ?? 70}
            min={0}
            step={1}
          />
        </fieldset>

        <fieldset>
          <label>Activity level</label>
          <input
            name="activity"
            type="number"
            defaultValue={loaderData?.activity}
            step={0.1}
            min={0.8}
            max={2.0}
          />
          <span>
            Some value representing your activity. 1 if you don’t know, 1.8 if
            you are quite active.
          </span>
        </fieldset>

        <fieldset>
          <label>Target deficit/surplus</label>
          <input
            name="delta"
            type="number"
            defaultValue={loaderData?.delta}
            min={-15}
            max={15}
            step={1}
          />
          <span>If you want to lose weight, put 5% for example.</span>
        </fieldset>

        <button>Get maintenance</button>
      </Form>
      {loaderData?.maintenance ? (
        <>
          <p>Maintenance: {loaderData.maintenance}</p>
          <p>Target: {loaderData.target}</p>
        </>
      ) : null}
    </div>
  );
}
