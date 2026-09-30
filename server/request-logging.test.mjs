import { expect, it } from "vitest";
import logging from "./request-logging.cjs";

it("keeps request paths while excluding magic-link tokens and OAuth codes", () => {
  expect(
    logging.safeRequestUrl({
      originalUrl:
        "/api/auth/magic-link/verify?token=secret&callbackURL=/sign-in",
    }),
  ).toBe("/api/auth/magic-link/verify");
  expect(
    logging.safeRequestUrl({
      url: "/oauth/authorize?code=secret&state=private",
    }),
  ).toBe("/oauth/authorize");
  expect(logging.safeRequestUrl({ url: "/nutrition?date=2026-09-30" })).toBe(
    "/nutrition",
  );
  expect(logging.safeRequestUrl({})).toBe("/");
});
