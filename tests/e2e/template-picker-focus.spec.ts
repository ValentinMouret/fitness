import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("template picker returns focus to the originating meal control", async ({
  page,
}) => {
  await page.goto("/nutrition?date=1901-03-01");
  for (const meal of ["Breakfast", "Lunch"]) {
    const opener = page.getByRole("button", {
      name: `Use template for ${meal}`,
      exact: true,
    });
    await opener.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close (Esc)", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});
