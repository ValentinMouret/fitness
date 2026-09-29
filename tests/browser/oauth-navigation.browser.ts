import { expect, test } from "@playwright/test";
import { decide, type OAuthClient } from "../e2e/support/oauth";

const client: OAuthClient = {
  name: "Navigation fixture",
  id: "navigation-fixture",
  secret: "fixture-secret",
  callback: "https://callback.example.invalid/callback",
};

test("consent waits for callback load before navigating to the next client", async ({
  page,
}) => {
  const consent = "https://fitness.example.invalid/consent";
  const next = "https://fitness.example.invalid/next-client";
  const callback = `${client.callback}?code=fixture-code&state=fixture-state`;
  await page.route(consent, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<button disabled onclick="location.href='${callback}'">Allow</button>`,
    }),
  );
  await page.route(next, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "Next client consent",
    }),
  );
  await page.goto(consent);
  let settled = false;
  const decision = decide(page, client, true).then((url) => {
    settled = true;
    return url;
  });
  let started!: () => void;
  const callbackStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const callbackReleased = new Promise<void>((resolve) => {
    release = resolve;
  });
  const resource = "https://callback.example.invalid/held.js";
  await page.route(resource, async (route) => {
    started();
    await callbackReleased;
    await route.fulfill({
      contentType: "text/javascript",
      body: "",
    });
  });
  // Override decide's callback fixture and hold a resource required for load.
  await page.route(`${client.callback}*`, (route) => {
    return route.fulfill({
      contentType: "text/html",
      body: `<script src="${resource}"></script>Committed callback`,
    });
  });
  await page
    .getByRole("button", { name: "Allow", exact: true })
    .evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Missing consent button");
      }
      button.disabled = false;
    });
  try {
    await callbackStarted;
    await page.context().cookies();
    expect(settled, "decide must wait for callback load").toBe(false);
  } finally {
    release();
  }
  const committed = await decision;
  expect(committed.href).toBe(callback);
  expect(committed.searchParams.get("code")).toBe("fixture-code");
  expect(committed.searchParams.get("state")).toBe("fixture-state");
  expect(page.url()).toBe(committed.href);
  await page.goto(next);
  await expect(
    page.getByText("Next client consent", { exact: true }),
  ).toBeVisible();
});
