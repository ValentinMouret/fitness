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
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL("./saved-set-layout.fixture.tsx", import.meta.url),
        ),
        name: "SavedSetFixture",
        formats: ["iife"],
      },
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
        },
      },
    },
  });
  for (const result of Array.isArray(bundle) ? bundle : [bundle]) {
    if (!("output" in result)) throw new Error("Missing fixture bundle");
    for (const output of result.output) {
      if (output.type === "chunk") script += output.code;
      else if (output.fileName.endsWith(".css"))
        styles += output.source.toString();
    }
  }
});

for (const width of [320, 390]) {
  test(`saved rows remain compact and effort controls work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent(
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    );
    await page.addStyleTag({ content: styles });
    await page.addScriptTag({ content: script });
    const rows = page.locator(".set-row");
    await expect(rows).toHaveCount(4);
    const warmup = rows.nth(0);
    const box = await warmup.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(64);
    await expect(warmup).not.toContainText("—");
    for (const name of ["Edit set 1", "Remove set 1"]) {
      const button = warmup.getByRole("button", { name, exact: true });
      const buttonBox = await button.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.y).toBeGreaterThanOrEqual(box?.y ?? 0);
      expect(
        (buttonBox?.y ?? 0) + (buttonBox?.height ?? 0),
      ).toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0));
    }
    await warmup.getByRole("button", { name: "Edit set 1", exact: true }).tap();
    await expect(
      page.getByRole("textbox", { name: "Set 1 weight", exact: true }),
    ).toBeVisible();
    await warmup.getByRole("button", { name: "Cancel", exact: true }).tap();
    await rows
      .nth(1)
      .getByRole("button", { name: "Add set 2 reported effort", exact: true })
      .tap();
    await expect(
      rows.nth(1).getByText("How many more good reps could you have done?", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      rows.nth(2).getByRole("button", {
        name: "Edit set 3 reported effort",
        exact: true,
      }),
    ).toHaveText("~2 left");
    await expect(rows.nth(3)).toContainText("RPE 8 (legacy)");
    await expect(rows.nth(3)).not.toContainText("—");
    await page
      .getByRole("button", { name: "View completed workout", exact: true })
      .tap();
    expect((await rows.nth(1).boundingBox())?.height).toBeLessThanOrEqual(64);
    await expect(rows.nth(1)).not.toContainText("—");
    await expect(rows.nth(2)).toContainText("~2 left");
    await expect(rows.nth(3)).toContainText("RPE 8 (legacy)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
