import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

const databaseUrl = process.env.E2E_DATABASE_URL;
const pool = new pg.Pool({ connectionString: databaseUrl });
test.skip(!databaseUrl, "Set E2E_DATABASE_URL to a dedicated test database");
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
let templateId: string;
let templateName: string;

test.beforeEach(async ({ page }) => {
  templateId = randomUUID();
  templateName = `Picker test ${templateId}`;
  await pool.query(
    `insert into meal_templates
      (id, name, category, total_calories, total_protein, total_carbs, total_fat, total_fiber, satiety_score)
      values ($1, $2, 'lunch', 400, 30, 40, 10, 5, 3)`,
    [templateId, templateName],
  );
  await pool.query(
    `insert into meal_template_ingredients (meal_template_id, ingredient_id, quantity_grams)
      select $1, id, 100 from ingredients where deleted_at is null limit 1`,
    [templateId],
  );
  await page.goto("/nutrition?date=1901-03-01");
  await page.getByRole("button", { name: "Use template for Lunch" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test.afterEach(async () => {
  await pool.query(
    "delete from meal_log_ingredients where meal_log_id in (select id from meal_logs where meal_template_id = $1)",
    [templateId],
  );
  await pool.query("delete from meal_logs where meal_template_id = $1", [
    templateId,
  ]);
  await pool.query(
    "delete from meal_template_ingredients where meal_template_id = $1",
    [templateId],
  );
  await pool.query("delete from meal_templates where id = $1", [templateId]);
});
test.afterAll(async () => {
  await pool.end();
});

test("the visible close button dismisses the meal picker on its first touch", async ({
  page,
}, testInfo) => {
  await testInfo.attach("mobile-meal-picker", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Close (Esc)", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Use template for Lunch" }),
  ).toBeVisible();
});

test("close still works after dismissing a template's sharing menu", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: `Share options for ${templateName}` })
    .tap();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Close (Esc)", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("outside touch and Escape dismiss the picker", async ({ page }) => {
  await page.touchscreen.tap(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use template for Lunch" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use template for Lunch" }).tap();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .filter({ hasText: templateName })
    .tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => {
      const result = await pool.query(
        "select id from meal_logs where meal_template_id = $1",
        [templateId],
      );
      return result.rowCount;
    })
    .toBe(1);
});
