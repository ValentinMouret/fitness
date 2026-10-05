import { expect, test } from "@playwright/test";

test("ordinary compiled app keeps synthetic design routes unavailable", async ({
  request,
}) => {
  for (const path of [
    "/design/type",
    "/design/type/editorial?screen=workout&saved=warm",
    "/design/type/sans?screen=auth",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
    expect(
      (
        await request.post(path, { form: { email: "example@example.invalid" } })
      ).status(),
    ).toBe(404);
  }
});
