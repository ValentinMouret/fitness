import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

let script = "";
let styles = "";

test.beforeAll(async () => {
  const bundle = await build({
    configFile: false,
    root: fileURLToPath(new URL("../..", import.meta.url)),
    plugins: [tsconfigPaths()],
    esbuild: { jsxDev: false },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
        },
      },
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL("./meal-picker.fixture.tsx", import.meta.url),
        ),
        name: "MealPickerFixture",
        formats: ["iife"],
      },
    },
  });
  for (const result of Array.isArray(bundle) ? bundle : [bundle]) {
    if (!("output" in result))
      throw new Error("Expected a completed fixture build");
    for (const output of result.output) {
      if (output.type === "chunk") script += output.code;
      else if (output.fileName.endsWith(".css"))
        styles += output.source.toString();
    }
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    console.error(error);
  });
  await page.setContent('<html><body><div id="root"></div></body></html>');
  if (testInfo.tags.includes("@workout")) {
    await page.evaluate(() => {
      window.location.hash = "workout";
    });
  }
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: script });
  expect(
    pageErrors,
    "Component fixture must render without runtime errors",
  ).toEqual([]);
  if (!testInfo.tags.includes("@workout")) {
    await page.getByRole("button", { name: "Use template for Lunch" }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
});

test("first touch closes the picker", async ({ page }) => {
  const close = page.getByRole("button", { name: "Close (Esc)", exact: true });
  await expect
    .poll(async () => (await close.boundingBox())?.width)
    .toBeGreaterThanOrEqual(44);
  await expect
    .poll(async () => (await close.boundingBox())?.height)
    .toBeGreaterThanOrEqual(44);
  await close.tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("outside touch then reopening permits first Escape dismissal", async ({
  page,
}) => {
  await page.touchscreen.tap(5, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use template for Lunch" }).tap();
  await expect(
    page.getByRole("button", { name: "Close (Esc)", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("share menu dismissal and actions leave template selection intact", async ({
  page,
}) => {
  const share = page.getByRole("button", {
    name: "Share options for Lunch bowl",
  });
  await share.tap();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await share.tap();
  await page.getByRole("menuitem", { name: "Publish & copy link" }).tap();
  await expect(page.locator("output")).toHaveText("Template published");
  await expect(page.getByRole("dialog")).toBeVisible();
  await share.tap();
  await page.getByRole("menuitem", { name: "Copy link", exact: true }).tap();
  await expect(page.locator("output")).toHaveText("Link copied");
  await page.getByRole("button", { name: "Close (Esc)", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Use template for Lunch" }).tap();
  await page.getByRole("button", { name: "Lunch bowl (1)", exact: true }).tap();
  await expect(page.locator("output")).toHaveText("Template applied");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test(
  "fast successful set actions notify once and open only the latest effort prompt",
  { tag: "@workout" },
  async ({ page }) => {
    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .tap();
    await expect(
      page.getByText("Completed callbacks: 1", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".set-row__report-prompt")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Complete set 2", exact: true })
      .tap();
    await expect(
      page.getByText("Completed callbacks: 2", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".set-row__report-prompt")).toHaveCount(1);
    await expect(
      page.locator(".set-row").nth(1).locator(".set-row__report-prompt"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add set 1 reported effort", exact: true })
      .tap();
    await expect(page.locator(".set-row__report-prompt")).toHaveCount(1);
    await expect(
      page.locator(".set-row").first().locator(".set-row__report-prompt"),
    ).toBeVisible();
    await expect(
      page.getByText("Completed callbacks: 2", { exact: true }),
    ).toBeVisible();
  },
);
