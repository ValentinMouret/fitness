import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`shared page and section roles use Quiet editorial at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/dashboard",
      "/nutrition",
      "/nutrition/templates",
      "/workouts",
      "/workouts/exercises",
      "/measurements",
    ]) {
      await page.goto(path);
      const title = page.locator(".page-header__title");
      await expect(title).toHaveCount(1);
      await expect
        .poll(() =>
          title.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              family: style.fontFamily,
              size: style.fontSize,
              weight: style.fontWeight,
              line: style.lineHeight,
            };
          }),
        )
        .toEqual({
          family: '"Crimson Pro", Georgia, serif',
          size: "28px",
          weight: "500",
          line: "35px",
        });
      expect(
        await page
          .locator(".radix-themes")
          .first()
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--default-font-family"),
          ),
      ).toContain("DM Sans");
      for (const section of await page
        .locator(".section-header__title")
        .all()) {
        expect(
          await section.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              family: style.fontFamily,
              size: style.fontSize,
              weight: style.fontWeight,
            };
          }),
        ).toEqual({
          family: '"DM Sans", system-ui, sans-serif',
          size: "20px",
          weight: "500",
        });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        path,
      ).toBe(true);
    }
  });
}

for (const width of [320, 390]) {
  test(`habits retains its title and usable native controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/habits");
    await expect(page.locator(".heading-in")).toBeVisible();
    expect(
      await page
        .locator(".heading-in")
        .evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain("Crimson Pro");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await page.locator("button").all()) {
      expect(
        await button.evaluate(
          (element) => getComputedStyle(element).fontFamily,
        ),
      ).toContain("DM Sans");
    }
  });
}
