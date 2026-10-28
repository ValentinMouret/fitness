import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, expect, test, webkit } from "@playwright/test";
import { build } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { hermeticLaunchOptions } from "../hermetic-browser";
import { captureLayout, expectStableLayout } from "./interaction-layout";

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
    let browser: Browser;
    test.beforeAll(async () => {
      browser = await { chromium, webkit }[browserName].launch({
        args: browserName === "webkit" ? [] : hermeticLaunchOptions.args,
      });
    });
    test.afterAll(async () => {
      await browser?.close();
    });
    for (const width of [320, 361, 375, 389, 390]) {
      test(`set entry retains row and number alignment at ${width}px`, async () => {
        const page = await browser.newPage({
          viewport: { width, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
        try {
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
          if (width === 320 || width === 390) {
            for (const title of ["Dashboard", "Workouts"]) {
              const header = page.getByRole("region", {
                name: `${title} header`,
              });
              const heading = header.getByRole("heading", {
                name: title === "Dashboard" ? "Wed, Sep 30" : title,
                exact: true,
              });
              const action = header.getByRole(
                title === "Dashboard" ? "link" : "button",
              );
              const layout = await captureLayout({ heading, action });
              expect(layout.action.x).toBeGreaterThanOrEqual(
                layout.heading.x + layout.heading.width,
              );
              expect(layout.action.y).toBeLessThan(
                layout.heading.y + layout.heading.height,
              );
              expect(layout.action.x + layout.action.width).toBeLessThanOrEqual(
                width,
              );
              const wrapping = await action.evaluate((element) => {
                const range = document.createRange();
                const text = [...element.childNodes].find(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    node.textContent?.trim(),
                );
                if (!text) throw new Error("Missing header action label");
                range.selectNodeContents(text);
                return range.getClientRects().length;
              });
              expect(wrapping, `${title} action stays on one line`).toBe(1);
              await action.focus();
              expectStableLayout(
                layout,
                await captureLayout({ heading, action }),
                `${title} action focus`,
              );
            }
          }
          for (const name of [
            "Loaded set",
            ...(width === 320 || width === 390 ? ["Saved sets"] : []),
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
            const anchors = {
              firstRow: rows.nth(0),
              followingRow: rows.nth(1),
              setMarker: rows.nth(0).locator(".active-set__no"),
              adjacentAction: rows.nth(0).locator(":scope > :nth-child(4)"),
              completion: rows.nth(0).locator(":scope > :nth-child(5)"),
              blur: group.getByRole("button", {
                name: "Blur input",
                exact: true,
              }),
            };
            const initialLayout = await captureLayout(anchors);
            for (const marker of await group.locator(".active-set__no").all()) {
              const offset = await marker.evaluate((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const text = range.getBoundingClientRect();
                const box = element.getBoundingClientRect();
                return {
                  x: Math.abs(text.x + text.width / 2 - box.x - box.width / 2),
                  y: Math.abs(
                    text.y + text.height / 2 - box.y - box.height / 2,
                  ),
                };
              });
              expect(
                offset.x,
                `${name} W/number horizontal center`,
              ).toBeLessThanOrEqual(1);
              expect(
                offset.y,
                `${name} W/number vertical center`,
              ).toBeLessThanOrEqual(2);
            }
            if (
              browserName === "chromium" &&
              width === 320 &&
              name === "Loaded set"
            ) {
              const injected = await page.addStyleTag({
                content:
                  ".active-set__tick { position: relative !important; left: 7px !important; transition: none !important; }",
              });
              const regressed = await captureLayout(anchors);
              expect(() =>
                expectStableLayout(
                  initialLayout,
                  regressed,
                  "deliberate adjacent control regression",
                ),
              ).toThrow(/completion.x/);
              await injected.evaluate((element) =>
                element.parentNode?.removeChild(element),
              );
              expectStableLayout(
                initialLayout,
                await captureLayout(anchors),
                "regression removed",
              );
            }

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
              expectStableLayout(
                initialLayout,
                await captureLayout(anchors),
                "focus/type/clear/blur/save",
              );
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
            if (name !== "Saved sets") {
              await group
                .getByRole("button", { name: "Complete set 1", exact: true })
                .tap();
              await expect(
                group.getByRole("button", {
                  name: "Complete set 1",
                  exact: true,
                }),
              ).toHaveAttribute("aria-pressed", "true");
              await assertGeometry();
            }
          }
          if (browserName === "chromium" && width === 320) {
            const probeStyles = await page.addStyleTag({
              content: `
              .layout-scroll-probe { overflow: scroll; width: 100px; height: 60px; }
              .layout-scroll-probe__inner { overflow: scroll; width: 180px; height: 150px; }
              .layout-scroll-probe__content { width: 400px; height: 400px; padding: 100px; }
            `,
            });
            const probe = page.getByRole("region", {
              name: "Nested scrolling",
            });
            const anchors = {
              button: probe.getByRole("button", {
                name: "Nested scroll anchor",
              }),
            };
            const before = await captureLayout(anchors);
            const offsets = await probe.evaluate((outer) => {
              const inner = outer.querySelector("div");
              if (!inner) throw new Error("Missing inner scroll container");
              outer.scrollLeft = 20;
              outer.scrollTop = 30;
              inner.scrollLeft = 15;
              inner.scrollTop = 40;
              return [
                outer.scrollLeft,
                outer.scrollTop,
                inner.scrollLeft,
                inner.scrollTop,
              ];
            });
            expect(offsets).toEqual([20, 30, 15, 40]);
            expectStableLayout(
              before,
              await captureLayout(anchors),
              "nested scrolling is not a layout shift",
            );
            await probeStyles.evaluate((element) =>
              element.parentNode?.removeChild(element),
            );
          }
          if (width === 320 || width === 390) {
            const disclosure = page.getByRole("region", {
              name: "Intentional expansion",
            });
            const anchors = {
              disclosure: disclosure.locator("details"),
              following: disclosure.getByRole("button", {
                name: "Following disclosure",
              }),
            };
            const collapsed = await captureLayout(anchors);
            await disclosure.locator("summary").tap();
            const expanded = await captureLayout(anchors);
            // Opening a disclosure deliberately establishes a new layout baseline.
            expect(expanded.disclosure.height).toBeGreaterThan(
              collapsed.disclosure.height,
            );
            expect(expanded.following.y).toBeGreaterThan(collapsed.following.y);
            await anchors.following.focus();
            expectStableLayout(
              expanded,
              await captureLayout(anchors),
              "focus after intentional expansion",
            );
          }
        } finally {
          await page.close();
        }
      });
    }
  });
}
