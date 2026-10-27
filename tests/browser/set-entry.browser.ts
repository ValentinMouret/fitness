import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect, test, webkit } from "@playwright/test";
import { build } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { hermeticLaunchOptions } from "../hermetic-browser";

let script = "";
let styles = "";
test.beforeAll(async () => {
  test.setTimeout(60_000);
  const result = await build({
    configFile: false,
    root: fileURLToPath(new URL("../..", import.meta.url)),
    plugins: [tsconfigPaths()],
    esbuild: { jsxDev: false },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL("./set-entry.fixture.tsx", import.meta.url),
        ),
        name: "SetEntry",
        formats: ["iife"],
      },
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning);
        },
      },
    },
  });
  for (const output of Array.isArray(result) ? result : [result]) {
    if (!("output" in output)) throw new Error("Missing fixture bundle");
    for (const item of output.output) {
      if (item.type === "chunk") script += item.code;
      else if (item.fileName.endsWith(".css")) styles += item.source.toString();
    }
  }
});

for (const browserName of ["chromium", "webkit"] as const) {
  test.describe(browserName, () => {
    for (const width of [320, 361, 375, 389, 390]) {
      test(`set entry retains row and number alignment at ${width}px`, async () => {
        const browser = await { chromium, webkit }[browserName].launch({
          args: browserName === "webkit" ? [] : hermeticLaunchOptions.args,
        });
        try {
          const page = await browser.newPage({
            viewport: { width, height: 844 },
            isMobile: true,
            hasTouch: true,
          });
          await page.route("**/*", (route) => route.abort());
          await page.setContent(
            '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
          );
          await page.addStyleTag({ content: styles });
          await page.addScriptTag({ content: script });
          await page.evaluate(() => document.fonts.ready);
          expect(
            await page.evaluate(() =>
              document.fonts.check('600 19px "DM Sans"'),
            ),
          ).toBe(true);
          for (const name of [
            "Loaded set",
            "Empty load",
            "Added bodyweight load",
          ]) {
            const group = page.getByRole("region", { name, exact: true });
            const rows = group.getByRole("listitem");
            await expect(rows).toHaveCount(2);
            await group.scrollIntoViewIfNeeded();
            const geometry = () =>
              rows.evaluateAll((elements) =>
                elements.map((element) => {
                  const row = element.getBoundingClientRect();
                  return {
                    top: row.top + window.scrollY,
                    height: row.height,
                    left: row.left,
                    width: row.width,
                  };
                }),
              );
            const initial = await geometry();
            const assertHeaderAlignment = async () => {
              const offsets = await group.evaluate((element) => {
                const headers = element.querySelectorAll(
                  ".active-set-table__head > span",
                );
                const cells = element.querySelector(".active-set")?.children;
                if (!cells) throw new Error("Missing first row");
                return [1, 2].map((column) => {
                  const header = headers[column].getBoundingClientRect();
                  const cell = cells[column].getBoundingClientRect();
                  return Math.abs(
                    header.left + header.width / 2 - cell.left - cell.width / 2,
                  );
                });
              });
              for (const offset of offsets)
                expect(
                  offset,
                  `${name} numeric header center`,
                ).toBeLessThanOrEqual(1);
            };
            await assertHeaderAlignment();
            const assertGeometry = async () => {
              const current = await geometry();
              for (const [index, row] of current.entries()) {
                for (const key of ["top", "height", "left", "width"] as const) {
                  expect(
                    Math.abs(row[key] - initial[index][key]),
                    `${name}, row ${index + 1} ${key}`,
                  ).toBeLessThan(0.1);
                }
              }
              await assertHeaderAlignment();
            };
            for (const field of ["reps", "weight"]) {
              const label =
                field === "weight" && name === "Added bodyweight load"
                  ? "Set 1 added weight"
                  : `Set 1 ${field}`;
              const button = group.getByRole("button", {
                name: new RegExp(`^${label}:`),
              });
              const before = await button.evaluate((element) => {
                const box = element.getBoundingClientRect();
                const value = element.querySelector(".active-set-cell__value");
                if (!value) throw new Error("Missing numeric value");
                const style = getComputedStyle(value);
                const text = value.getBoundingClientRect();
                return {
                  left: box.left,
                  top: box.top + window.scrollY,
                  width: box.width,
                  height: box.height,
                  units: [
                    ...element.querySelectorAll(".active-set-cell__unit"),
                  ].map((unit) => {
                    const rect = unit.getBoundingClientRect();
                    return {
                      top: rect.top + window.scrollY,
                      height: rect.height,
                    };
                  }),
                  textTop: text.top + window.scrollY,
                  textHeight: text.height,
                  center: text.left + text.width / 2,
                  fontSize: style.fontSize,
                  lineHeight: style.lineHeight,
                };
              });
              await button.tap();
              const input = group.getByRole("textbox", {
                name: label,
                exact: true,
              });
              await expect(input).toBeFocused();
              const during = await input.evaluate((element) => {
                const box = element.parentElement?.getBoundingClientRect();
                if (!box) throw new Error("Missing editable cell");
                const text = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {
                  left: box.left,
                  top: box.top + window.scrollY,
                  width: box.width,
                  height: box.height,
                  units: [
                    ...(element.parentElement?.querySelectorAll(
                      ".active-set-cell__unit",
                    ) ?? []),
                  ].map((unit) => {
                    const rect = unit.getBoundingClientRect();
                    return {
                      top: rect.top + window.scrollY,
                      height: rect.height,
                    };
                  }),
                  textTop: text.top + window.scrollY,
                  textHeight: text.height,
                  center: text.left + text.width / 2,
                  fontSize: style.fontSize,
                  lineHeight: style.lineHeight,
                };
              });
              for (const key of ["left", "top", "width", "height"] as const) {
                expect(
                  Math.abs(during[key] - before[key]),
                  `${label} ${key}`,
                ).toBeLessThan(0.1);
              }
              // The unweighted dash intentionally uses the smaller muted style.
              if (!(field === "weight" && name === "Empty load")) {
                expect(during.fontSize).toBe(before.fontSize);
                expect(during.lineHeight).toBe(before.lineHeight);
                expect(
                  Math.abs(during.textTop - before.textTop),
                  `${label} text baseline`,
                ).toBeLessThanOrEqual(1);
                expect(
                  Math.abs(during.center - before.center),
                  `${label} numeric center`,
                ).toBeLessThanOrEqual(1);
              }
              expect(during.units).toHaveLength(before.units.length);
              for (const [index, unit] of during.units.entries()) {
                expect(
                  Math.abs(unit.top - before.units[index].top),
                  `${label} unit baseline`,
                ).toBeLessThan(0.1);
                expect(
                  Math.abs(unit.height - before.units[index].height),
                  `${label} unit line height`,
                ).toBeLessThan(0.1);
              }
              await assertGeometry();
              for (const value of [
                "8",
                field === "weight" ? "22.5" : "125",
                "",
              ]) {
                await input.fill(value);
                await assertGeometry();
                if (field === "weight" && value === "22.5") {
                  await expect(input).toHaveValue(value);
                  const readability = await input.evaluate((element) => {
                    const style = getComputedStyle(element);
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");
                    if (!context)
                      throw new Error("Missing text measurement context");
                    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                    return {
                      inputWidth: element.clientWidth,
                      textWidth: context.measureText("22.5").width,
                      scrollWidth: element.scrollWidth,
                      visibility: style.visibility,
                    };
                  });
                  await writeFile(
                    `/tmp/fitness-set-entry-readability-${browserName}-${width}-${name.replaceAll(" ", "-").toLowerCase()}.json`,
                    JSON.stringify({
                      browserName,
                      width,
                      scenario: name,
                      ...readability,
                    }),
                  );
                  expect(
                    readability.inputWidth,
                    `${label} must fit the entered weight`,
                  ).toBeGreaterThanOrEqual(readability.textWidth);
                  expect(
                    readability.scrollWidth,
                    `${label} must not clip text horizontally`,
                  ).toBeLessThanOrEqual(readability.inputWidth + 1);
                  expect(readability.visibility).toBe("visible");
                }
                if (value === "8" || value === "22.5") {
                  await page.screenshot({
                    path: `/tmp/fitness-set-entry-${browserName}-${width}-${name.replaceAll(" ", "-").toLowerCase()}-${field}-${value === "22.5" ? "decimal" : "filled"}.png`,
                  });
                }
              }
              await page.screenshot({
                path: `/tmp/fitness-set-entry-${browserName}-${width}-${name.replaceAll(" ", "-").toLowerCase()}-${field}.png`,
              });
              await group
                .getByRole("button", { name: "Blur input", exact: true })
                .tap();
              await assertGeometry();
            }
          }
        } finally {
          await browser.close();
        }
      });
    }
  });
}
