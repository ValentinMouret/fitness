import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("template picker returns focus to the originating meal control", async ({
  page,
}) => {
  await page.goto("/nutrition?date=1901-03-01");
  for (const meal of ["Breakfast", "Lunch"]) {
    const opener = page.getByRole("button", {
      name: `Meal actions for ${meal}`,
      exact: true,
    });
    await opener.tap();
    await page
      .getByRole("menuitem", { name: "Use template", exact: true })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: "Close (Esc)", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((element) => getComputedStyle(element).pointerEvents),
      )
      .toBe("auto");
    await opener.tap();
    await page
      .getByRole("menuitem", { name: "Use template", exact: true })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((element) => getComputedStyle(element).pointerEvents),
      )
      .toBe("auto");
  }
});

test("keyboard template reuse restores the page after dismissal", async ({
  page,
}) => {
  await page.goto("/nutrition?date=1901-03-01");
  const opener = page.getByRole("button", {
    name: "Meal actions for Breakfast",
    exact: true,
  });
  await opener.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem", { name: "Use template", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator("body")
        .evaluate((element) => getComputedStyle(element).pointerEvents),
    )
    .toBe("auto");
  await page
    .getByRole("button", { name: "Meal actions for Lunch", exact: true })
    .tap();
  await expect(
    page.getByRole("menuitem", { name: "Use template", exact: true }),
  ).toBeVisible();
});
