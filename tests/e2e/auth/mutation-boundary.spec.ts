import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { expectUnauthenticated, login } from "../support/auth";

test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

for (const attack of ["unauthenticated", "cross-site"] as const) {
  test(`${attack} exercise creation cannot write before returning an error`, async ({
    page,
    playwright,
    baseURL,
  }) => {
    await login(page);
    const marker = randomUUID();
    const visitor = await playwright.request.newContext({ baseURL });
    try {
      const response = await (attack === "cross-site"
        ? page.request
        : visitor
      ).post("/workouts/exercises/create", {
        headers:
          attack === "cross-site"
            ? {
                Origin: "https://attacker.invalid",
                "Sec-Fetch-Site": "cross-site",
              }
            : {},
        form: {
          name: `Auth e2e ${marker}`,
          type: "barbell",
          movementPattern: "push",
        },
        maxRedirects: 0,
      });
      await page.goto(`/workouts/exercises?q=${marker}`);
      await expect(
        page.getByRole("searchbox", { name: "Search exercises" }),
      ).toBeVisible();
      const matches = page.getByRole("link", {
        name: new RegExp(`^Edit .*${marker}`),
      });
      const persisted = await matches.count();
      // Clean up only this test's unique record even when the security assertion fails.
      for (const match of await matches.all()) {
        const href = await match.getAttribute("href");
        const exerciseId = href?.match(
          /^\/workouts\/exercises\/([^/]+)\/edit$/,
        )?.[1];
        if (!exerciseId)
          throw new Error("Cannot identify the test exercise for cleanup");
        const cleanup = await page.request.post("/workouts/exercises", {
          headers: { Origin: new URL(page.url()).origin },
          form: { exerciseId },
        });
        expect(cleanup.status()).toBe(200);
        expect((await cleanup.json()).success).toBe(true);
      }
      expect(persisted, "The rejected request persisted an exercise").toBe(0);
      if (attack === "cross-site")
        expect([400, 403]).toContain(response.status());
      else expectUnauthenticated(response);
    } finally {
      await visitor.dispose();
    }
  });
}
