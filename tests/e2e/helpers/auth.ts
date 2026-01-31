import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/login");

  // Fill in the login form
  await page.getByPlaceholder("Enter your username").fill("testuser");
  await page.getByPlaceholder("Enter your password").fill("testpassword");

  // Submit the form
  await page.getByRole("button", { name: "Login" }).click();

  // Verify redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/);
}
