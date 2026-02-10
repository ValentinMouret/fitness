import { expect, test } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should display login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter your username")).toBeVisible();
    await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.getByPlaceholder("Enter your username").fill("wronguser");
    await page.getByPlaceholder("Enter your password").fill("wrongpassword");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByText("Invalid username or password")).toBeVisible();
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.getByPlaceholder("Enter your username").fill("testuser");
    await page.getByPlaceholder("Enter your password").fill("testpassword");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
