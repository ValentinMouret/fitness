import type { Page } from "@playwright/test";

export async function ensureExerciseExists(page: Page) {
  const response = await page.request.post("/workouts/exercises/create", {
    form: {
      name: "E2E Test Bench Press",
      type: "barbell",
      movementPattern: "push",
    },
  });
  return response;
}
