import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`Nutrition navigation stays fixed between views at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/nutrition");
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator(".page-transition")
          .evaluate((element) => getComputedStyle(element).opacity),
      )
      .toBe("1");
    const navigation = page.getByRole("navigation", {
      name: "Nutrition views",
    });
    const title = page.getByRole("heading", { name: "Nutrition", exact: true });
    const original = await navigation.boundingBox();
    const originalTitle = await title.boundingBox();
    if (!original || !originalTitle)
      throw new Error("Missing Nutrition header");
    for (const view of ["Templates", "Today", "Templates"]) {
      await navigation.getByRole("link", { name: view, exact: true }).click();
      await expect(
        navigation.getByRole("link", { name: view, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect
        .poll(async () => (await navigation.boundingBox())?.y)
        .toBe(original.y);
      const currentTitle = await title.boundingBox();
      expect(currentTitle).toEqual(originalTitle);
      await expect(page.locator(".page-header__actions > *")).toHaveCount(0);
    }
    const create = page.getByRole("link", {
      name: "Create template",
      exact: true,
    });
    const createBox = await create.boundingBox();
    const headingBox = await page
      .getByRole("heading", { name: "Meal templates", exact: true })
      .boundingBox();
    if (!createBox || !headingBox) throw new Error("Missing template actions");
    expect(createBox.y).toBeGreaterThan(original.y + original.height);
    expect(createBox.height).toBeGreaterThanOrEqual(44);
    expect(createBox.x).toBeGreaterThanOrEqual(headingBox.x + headingBox.width);
    expect(createBox.x + createBox.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await create.click();
    await expect(page).toHaveURL(/\/nutrition\/meal-builder\?returnTo=/);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/nutrition\/templates\?meal=all$/);
    await expect(navigation).toBeVisible();
  });
}
