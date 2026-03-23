import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Auth Flow", () => {
  test.describe("Login", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("should display login form with all elements", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
      await expect(page.getByPlaceholder("Enter your username")).toBeVisible();
      await expect(page.getByPlaceholder("Enter your password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });

    test("should show error with invalid credentials", async ({ page }) => {
      await page.getByPlaceholder("Enter your username").fill("wronguser");
      await page.getByPlaceholder("Enter your password").fill("wrongpassword");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(
        page.getByText("Invalid username or password"),
      ).toBeVisible();
      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("should login successfully with valid credentials", async ({
      page,
    }) => {
      await page.getByPlaceholder("Enter your username").fill("testuser");
      await page.getByPlaceholder("Enter your password").fill("testpassword");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("should set session cookie on successful login", async ({ page }) => {
      await page.getByPlaceholder("Enter your username").fill("testuser");
      await page.getByPlaceholder("Enter your password").fill("testpassword");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/dashboard/);

      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(
        (c) => c.name === "fitness-rr-session",
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toContain("testuser");
    });

    test("password field should be masked", async ({ page }) => {
      const passwordInput = page.getByPlaceholder("Enter your password");
      await expect(passwordInput).toHaveAttribute("type", "password");
    });
  });

  test.describe("Redirect after login", () => {
    test("should redirect to dashboard by default after login", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.getByPlaceholder("Enter your username").fill("testuser");
      await page.getByPlaceholder("Enter your password").fill("testpassword");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("should redirect to specified URL after login", async ({ page }) => {
      await page.goto("/login?redirectTo=%2Fworkouts");
      await page.getByPlaceholder("Enter your username").fill("testuser");
      await page.getByPlaceholder("Enter your password").fill("testpassword");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(page).toHaveURL(/\/workouts/);
    });
  });

  test.describe("Protected routes", () => {
    test("should redirect unauthenticated user to login", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should include redirectTo param when redirecting to login", async ({
      page,
    }) => {
      await page.goto("/workouts");
      await expect(page).toHaveURL(/\/login\?redirectTo=/);
      expect(page.url()).toContain(encodeURIComponent("/workouts"));
    });

    test("should allow access to protected routes when authenticated", async ({
      page,
    }) => {
      await login(page);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe("Logout", () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test("should logout via GET /logout", async ({ page }) => {
      await page.goto("/logout");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should clear session cookie on logout", async ({ page }) => {
      await page.goto("/logout");
      await expect(page).toHaveURL(/\/login/);

      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(
        (c) => c.name === "fitness-rr-session",
      );
      // Cookie should either be gone or have empty value
      expect(!sessionCookie || sessionCookie.value === "").toBeTruthy();
    });

    test("should not access protected routes after logout", async ({
      page,
    }) => {
      await page.goto("/logout");
      await expect(page).toHaveURL(/\/login/);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Session persistence", () => {
    test("should maintain session across page navigations", async ({
      page,
    }) => {
      await login(page);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);

      // Navigate to another protected route
      await page.goto("/workouts");
      await expect(page).not.toHaveURL(/\/login/);
    });
  });
});
