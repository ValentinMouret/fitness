import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`Nutrition workspace preserves date across template navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/nutrition?date=1905-05-08");
    await expect(
      page.getByRole("heading", { name: "Your day", exact: true }),
    ).toBeVisible();
    const dayControl = page.getByRole("button", {
      name: "Mon, May 8. Go to Today (T)",
      exact: true,
    });
    await expect(dayControl).toHaveText("Mon, May 8");
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Log meal", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "More Nutrition actions", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Meal actions for / }),
    ).toHaveCount(4);
    const tools = page.locator(".nutrition-tools");
    await expect(
      tools.getByRole("link", { name: "Meal Builder", exact: true }),
    ).toHaveAttribute("href", "/nutrition/meal-builder");
    await expect(
      tools.getByRole("link", { name: "Calculate targets", exact: true }),
    ).toHaveAttribute("href", "/nutrition/calculate-targets");
    await expect(
      tools.getByRole("button", { name: "Estimate meal (E)", exact: true }),
    ).toBeVisible();
    const templates = page.getByRole("link", {
      name: "Meal templates →",
      exact: true,
    });
    await expect(templates).toHaveAttribute(
      "href",
      "/nutrition/templates?date=1905-05-08",
    );
    const linkBox = await templates.boundingBox();
    const toolsBox = await tools.boundingBox();
    if (!linkBox || !toolsBox) throw new Error("Missing workspace navigation");
    expect(linkBox.y).toBeGreaterThanOrEqual(toolsBox.y + toolsBox.height);
    expect(Math.round(linkBox.height)).toBeGreaterThanOrEqual(44);
    await templates.click();
    await expect(
      page.getByRole("heading", { name: "Meal templates", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back", exact: true }),
    ).toHaveAttribute("href", "/nutrition?date=1905-05-08");
    await page
      .getByRole("combobox", { name: "Meal time", exact: true })
      .selectOption("lunch");
    await expect(page).toHaveURL(/meal=lunch/);
    await expect(page).toHaveURL(/date=1905-05-08/);
    const create = page.getByRole("link", {
      name: "Create template",
      exact: true,
    });
    await create.click();
    await expect(page).toHaveURL(/\/nutrition\/meal-builder\?returnTo=/);
    await expect(
      page.getByRole("heading", { name: "Meal Builder", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/meal=lunch&date=1905-05-08$/);
    await page
      .getByRole("link", { name: "← Back to today", exact: true })
      .click();
    await expect(page).toHaveURL(/\/nutrition\?date=1905-05-08$/);
    await expect(
      page.getByRole("heading", { name: "Your day", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const figures = page.locator(
      ".nutrition-summary > strong, .nutrition-macro-card__value",
    );
    for (const figure of await figures.all()) {
      await expect(figure).toHaveCSS("font-variant-numeric", "tabular-nums");
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    await expect(page.locator(".nutrition-summary > p")).toHaveCSS(
      "font-size",
      "15px",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.screenshot({
      path: `/tmp/fitness-nutrition-workspace-${width}.png`,
      fullPage: true,
    });
  });
}
