import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import pg from "pg";
import {
  canWriteFixtureDatabase,
  verifyFixtureServerDatabase,
} from "./support/fixture-database";

type Scenario = "rows" | "working" | "warmup" | "finished";
const test = base.extend<{
  readonly scenario: Scenario;
  readonly fixture: {
    readonly id: string;
    readonly pool: pg.Pool;
    readonly exerciseId: string;
  };
}>({
  scenario: ["rows", { option: true }],
  fixture: async ({ request, scenario }, use) => {
    const pool = new pg.Pool({
      connectionString: process.env.E2E_DATABASE_URL,
    });
    const id = randomUUID();
    const exerciseIds = Array.from(
      { length: scenario === "rows" ? 2 : 1 },
      () => randomUUID(),
    );
    try {
      await verifyFixtureServerDatabase(request, pool);
      await pool.query(
        "insert into workouts (id,name,start,stop) values ($1,'Approved row acceptance',$2,$3)",
        [
          id,
          new Date().toISOString(),
          scenario === "finished" ? new Date().toISOString() : null,
        ],
      );
      for (const [index, exerciseId] of exerciseIds.entries()) {
        await pool.query(
          "insert into exercises (id,name,type,movement_pattern) values ($1,$2,'barbell','push')",
          [exerciseId, `Approved exercise ${exerciseId}`],
        );
        await pool.query(
          "insert into workout_exercises (workout_id,exercise_id,order_index) values ($1,$2,$3)",
          [id, exerciseId, index],
        );
        const count = scenario === "rows" && index === 0 ? 4 : 1;
        for (let set = 1; set <= count; set++) {
          const warmup =
            scenario === "warmup" ||
            (scenario === "rows" && index === 0 && [2, 3].includes(set));
          const completed =
            scenario === "finished" ||
            (scenario === "rows" && index === 0 && [1, 3].includes(set));
          await pool.query(
            'insert into workout_sets (workout,exercise,set,reps,weight,"isCompleted","isWarmup",reported_rir,rpe) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              id,
              exerciseId,
              set,
              completed || scenario !== "rows" ? 8 : null,
              warmup ? 20 : 60,
              completed,
              warmup,
              completed && !warmup ? "2" : null,
              scenario === "rows" && index === 0 && set === 1 ? 8 : null,
            ],
          );
        }
      }
      await use({ id, pool, exerciseId: exerciseIds[0] });
    } finally {
      await pool.query("delete from workout_sets where workout=$1", [id]);
      await pool.query("delete from workout_exercises where workout_id=$1", [
        id,
      ]);
      await pool.query("delete from workouts where id=$1", [id]);
      await pool.query("delete from exercises where id=any($1::uuid[])", [
        exerciseIds,
      ]);
      await pool.end();
    }
  },
});
test.skip(
  !canWriteFixtureDatabase(process.env.E2E_DATABASE_URL),
  "Requires matching dedicated fixture database/server",
);
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function focus(page: Page, id: string) {
  await page.goto(`/workouts/${id}`);
  await page
    .getByRole("link", { name: /^Open Approved exercise/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\?exercise=/);
}
const row = (page: Page, number: number) =>
  page
    .locator(".active-workout-exercise:not([hidden]) .set-row")
    .nth(number - 1);
async function font(control: Locator, size: string) {
  await expect
    .poll(() =>
      control.evaluate((element) => ({
        size: getComputedStyle(element).fontSize,
        weight: getComputedStyle(element).fontWeight,
      })),
    )
    .toEqual({ size, weight: "400" });
}
async function touch(control: Locator) {
  const box = await control.boundingBox();
  expect(box && Math.round(box.width * 100) / 100).toBeGreaterThanOrEqual(44);
  expect(box && Math.round(box.height * 100) / 100).toBeGreaterThanOrEqual(44);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const width of [320, 390]) {
  test(`approved saved and pending rows preserve typography and touch access at ${width}px`, async ({
    page,
    fixture,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await focus(page, fixture.id);
    const saved = row(page, 1);
    await font(saved.locator(".set-row__value").first(), "16px");
    await font(saved.locator(".set-row__inline-rir .set-row__value"), "16px");
    await font(saved.locator(".set-row__inline-rir small"), "12px");
    await expect
      .poll(() =>
        page
          .locator(
            ".active-workout-exercise:not([hidden]) .set-table-header__label",
          )
          .first()
          .evaluate((element) => getComputedStyle(element).fontSize),
      )
      .toBe("12px");
    await expect
      .poll(() =>
        saved.evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .not.toBe("rgba(0, 0, 0, 0)");
    const emptyReps = row(page, 4).getByRole("textbox", {
      name: "Set 4 reps",
      exact: true,
    });
    await expect
      .poll(() =>
        emptyReps.evaluate(
          (element) =>
            getComputedStyle(element.closest(".set-row__input") ?? element)
              .borderTopStyle,
        ),
      )
      .toBe("dashed");
    await emptyReps.focus();
    await expect
      .poll(() =>
        emptyReps.evaluate(
          (element) =>
            getComputedStyle(element.closest(".set-row__input") ?? element)
              .outlineStyle,
        ),
      )
      .toBe("solid");
    await touch(
      saved.getByRole("button", {
        name: /^Edit set 1 reported effort, 8 reps$/,
      }),
    );
    await font(
      page.getByRole("textbox", { name: "Set 4 weight", exact: true }),
      "16px",
    );
    await font(
      page.getByRole("textbox", { name: "Set 4 reps", exact: true }),
      "16px",
    );
    await expect(saved.getByText("Saved", { exact: true })).toHaveCount(0);
    await expect(
      saved.getByRole("button", {
        name: /^Edit set 1 reported effort, 8 reps$/,
      }),
    ).toContainText("~2 left");
    await touch(saved.getByRole("button", { name: "Edit set 1", exact: true }));
    await touch(
      row(page, 4).getByRole("button", { name: "Complete set 4", exact: true }),
    );
    await touch(
      row(page, 2).getByRole("button", {
        name: "Toggle warmup for set 2",
        exact: true,
      }),
    );
    await expect(
      row(page, 2).getByRole("button", {
        name: "Toggle warmup for set 2",
        exact: true,
      }),
    ).toHaveText("W");
    await expect(row(page, 3).locator(".set-row__number")).toHaveText("W");
    const color = (value: Locator) =>
      value.evaluate((element) => getComputedStyle(element).color);
    const savedColor = await color(saved.locator(".set-row__value").first());
    await expect
      .poll(() => color(row(page, 3).locator(".set-row__value").first()))
      .toBe(savedColor);
    expect(await color(row(page, 3).locator(".set-row__number"))).not.toBe(
      savedColor,
    );
    const legacy = saved.locator(".set-row__reps > small");
    await expect(legacy).toContainText("RPE 8");
    const legacyBox = await legacy.boundingBox();
    const actionsBox = await saved.locator(".set-row__actions").boundingBox();
    if (!legacyBox || !actionsBox)
      throw new Error("Missing legacy/action bounds");
    expect(
      legacyBox.x + legacyBox.width <= actionsBox.x ||
        legacyBox.y + legacyBox.height <= actionsBox.y ||
        actionsBox.y + actionsBox.height <= legacyBox.y,
    ).toBe(true);
    await noOverflow(page);
    await page.screenshot({ path: `/tmp/fitness-approved-rows-${width}.png` });
    await row(page, 2)
      .getByRole("textbox", { name: "Set 2 reps", exact: true })
      .fill("5");
    await row(page, 2)
      .getByRole("button", { name: "Complete set 2", exact: true })
      .tap();
    await expect(row(page, 2)).toHaveClass(/set-row--completed/);
    await expect(row(page, 2).locator(".set-row__number")).toHaveText("W");
    expect(
      (
        await fixture.pool.query(
          'select "isWarmup","isCompleted" from workout_sets where workout=$1 and set=2',
          [fixture.id],
        )
      ).rows,
    ).toEqual([{ isWarmup: true, isCompleted: true }]);
    await saved.getByRole("button", { name: "Edit set 1", exact: true }).tap();
    await font(
      saved.getByRole("textbox", { name: "Set 1 reps", exact: true }),
      "16px",
    );
    await saved
      .getByRole("textbox", { name: "Set 1 weight", exact: true })
      .fill("");
    await saved.getByRole("button", { name: "Cancel", exact: true }).tap();
    await expect(saved.locator(".set-row__value").first()).toHaveText("60");
    await expect(
      saved.getByRole("button", {
        name: /^Edit set 1 reported effort, 8 reps$/,
      }),
    ).toContainText("~2 left");
    const weight = page.getByRole("textbox", {
      name: "Set 4 weight",
      exact: true,
    });
    const reps = page.getByRole("textbox", { name: "Set 4 reps", exact: true });
    await weight.fill("");
    await reps.fill("11");
    await page.getByRole("link", { name: "Next", exact: false }).click();
    await page.getByRole("link", { name: "Previous", exact: false }).click();
    await expect(weight).toHaveValue("");
    await expect(reps).toHaveValue("11");
    await noOverflow(page);
  });
}

test("saving with another pending set retains the current exercise and scroll position", async ({
  page,
  fixture,
}) => {
  await focus(page, fixture.id);
  const currentUrl = page.url();
  const save = row(page, 4).getByRole("button", {
    name: "Complete set 4",
    exact: true,
  });
  await save.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const scroller = page.locator(".main-content");
  const before = await scroller.evaluate((element) => element.scrollTop);
  await page.evaluate(() => {
    const calls: string[] = [];
    Object.assign(window, { approvedExerciseScrolls: calls });
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      const id = this.getAttribute("data-exercise-id");
      if (id) calls.push(id);
      return original.call(this, ...args);
    };
  });
  await save.tap();
  await expect(row(page, 4)).toHaveClass(/set-row--completed/);
  await expect(row(page, 2)).toHaveClass(/set-row--pending/);
  await expect(row(page, 4).locator(".set-row__report-prompt")).toBeVisible();
  await expect(page).toHaveURL(currentUrl);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeCloseTo(before, 0);
  expect(
    await page.evaluate(() => Reflect.get(window, "approvedExerciseScrolls")),
  ).toEqual([]);
  await expect
    .poll(
      async () =>
        (
          await fixture.pool.query(
            'select "isCompleted" from workout_sets where workout=$1 and exercise=$2 and set=2',
            [fixture.id, fixture.exerciseId],
          )
        ).rows,
    )
    .toEqual([{ isCompleted: false }]);
});

test.describe("final working set", () => {
  test.use({ scenario: "working" });
  test("RIR saves before completion suggestion, rest starts immediately and revalidation does not repeat", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await expect(row(page, 1).locator(".set-row__report-prompt")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Rest timer" })
        .getByRole("button", { name: "Skip", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Report 2 good reps left for set 1",
        exact: true,
      })
      .tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      (
        await fixture.pool.query(
          'select reported_rir as "reportedRir" from workout_sets where workout=$1',
          [fixture.id],
        )
      ).rows,
    ).toEqual([{ reportedRir: "2" }]);
    await dialog
      .getByRole("button", { name: "Keep training", exact: true })
      .click();
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.getByRole("link", { name: /^Open Approved exercise/ }).click();
    await expect(page).toHaveURL(/\?exercise=/);
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /^Edit set 1 reported effort, 8 reps$/,
      }),
    ).toContainText("~2 left");
  });
  test("explicit RIR Skip opens completion suggestion", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await row(page, 1)
      .locator(".set-row__report-prompt")
      .getByRole("button", { name: "Skip", exact: true })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      (
        await fixture.pool.query(
          'select reported_rir as "reportedRir" from workout_sets where workout=$1',
          [fixture.id],
        )
      ).rows,
    ).toEqual([{ reportedRir: null }]);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Finish workout", exact: true })
      .click();
    await expect(page).toHaveURL(/dashboard/);
  });
  test("a repeated RIR submission stays open while its real response is pending or rejected", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await page
      .getByRole("button", {
        name: "Report 2 good reps left for set 1",
        exact: true,
      })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Keep training", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^Edit set 1 reported effort, 8 reps$/ })
      .tap();
    let intercepted = false;
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/workouts/**", async (route) => {
      const request = route.request();
      const form = new URLSearchParams(request.postData() ?? "");
      if (request.method() === "POST" && form.has("reportedRir")) {
        intercepted = true;
        await held;
        form.set("setNumber", "999");
        await route.continue({ postData: form.toString() });
      } else await route.continue();
    });
    try {
      const report = page.getByRole("button", {
        name: "Report 3 good reps left for set 1",
        exact: true,
      });
      await report.tap();
      await expect.poll(() => intercepted).toBe(true);
      await expect(report).toBeDisabled();
      await expect(
        row(page, 1).locator(".set-row__report-prompt"),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (!release) throw new Error("Missing response release");
      release();
      await expect(
        row(page, 1).locator(".set-row__report-prompt"),
      ).toContainText("Failed to update set");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.unroute("**/workouts/**");
      await report.tap();
      await expect
        .poll(
          async () =>
            (
              await fixture.pool.query(
                "select reported_rir from workout_sets where workout=$1",
                [fixture.id],
              )
            ).rows,
        )
        .toEqual([{ reported_rir: "3" }]);
      await expect(row(page, 1).locator(".set-row__report-prompt")).toHaveCount(
        0,
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally {
      release?.();
      await page.unroute("**/workouts/**");
    }
  });

  test("a real invalid RIR update retains retry before completion", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await expect(row(page, 1).locator(".set-row__report-prompt")).toBeVisible();
    await page.route("**/workouts/**", async (route) => {
      const request = route.request();
      const form = new URLSearchParams(request.postData() ?? "");
      if (request.method() === "POST" && form.has("reportedRir")) {
        form.set("setNumber", "999");
        await route.continue({ postData: form.toString() });
      } else await route.continue();
    });
    await page
      .getByRole("button", {
        name: "Report 2 good reps left for set 1",
        exact: true,
      })
      .tap();
    await expect(row(page, 1).locator(".set-row__report-prompt")).toContainText(
      "Failed to update set",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.unroute("**/workouts/**");
    await page
      .getByRole("button", {
        name: "Report 2 good reps left for set 1",
        exact: true,
      })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("final warmup", () => {
  test.use({ scenario: "warmup" });
  test("saving a final warmup suggests completion without an effort prompt", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".set-row__report-prompt")).toHaveCount(0);
    expect(
      (
        await fixture.pool.query(
          'select "isWarmup","isCompleted" from workout_sets where workout=$1',
          [fixture.id],
        )
      ).rows,
    ).toEqual([{ isWarmup: true, isCompleted: true }]);
  });
});

test.describe("completed details", () => {
  test.use({ scenario: "finished" });
  test("stored RIR remains discoverable and editable after the workout finishes", async ({
    page,
    fixture,
  }) => {
    await focus(page, fixture.id);
    await expect(page.getByText("~2 left", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
    const rir = page.getByRole("combobox", {
      name: "Set 1 reported effort",
      exact: true,
    });
    await rir.selectOption("3");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("~2 left", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit set 1", exact: true }).click();
    await rir.selectOption("3");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await fixture.pool.query(
              'select reported_rir as "reportedRir" from workout_sets where workout=$1',
              [fixture.id],
            )
          ).rows,
      )
      .toEqual([{ reportedRir: "3" }]);
    await page.reload();
    await expect(page.getByText("~3 left", { exact: false })).toBeVisible();
  });
});
