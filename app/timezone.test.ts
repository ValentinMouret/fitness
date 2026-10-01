import { describe, expect, it } from "vitest";
import {
  addCalendarDay,
  addOneDay,
  dateInTimeZone,
  fromDateString,
  isSameCalendarDay,
  isSameDay,
  removeCalendarDay,
  removeOneDay,
  timeZoneSchema,
  toDateString,
} from "./time";

describe("account calendar dates", () => {
  it.each([
    ["Pacific/Auckland", "2026-01-01T11:30:00Z", "2026-01-02"],
    ["America/Los_Angeles", "2026-01-01T01:30:00Z", "2025-12-31"],
    ["Europe/Paris", "2026-03-28T23:30:00Z", "2026-03-29"],
    ["Europe/Paris", "2026-03-29T22:30:00Z", "2026-03-30"],
    ["Europe/Paris", "2026-10-25T00:30:00Z", "2026-10-25"],
    ["Europe/Paris", "2026-10-25T01:30:00Z", "2026-10-25"],
    ["UTC", "2026-01-01T23:30:00Z", "2026-01-01"],
  ])("uses %s at %s", (zone, instant, expected) => {
    expect(toDateString(dateInTimeZone(new Date(instant), zone))).toBe(
      expected,
    );
  });

  it("keeps date-only navigation stable across DST and host timezone", () => {
    const date = fromDateString("2026-03-29");
    expect(toDateString(addCalendarDay(date))).toBe("2026-03-30");
    expect(toDateString(removeCalendarDay(date))).toBe("2026-03-28");
    expect(isSameCalendarDay(date, new Date("2026-03-29T23:59:59Z"))).toBe(
      true,
    );
    expect(isSameCalendarDay(date, fromDateString("2026-03-30"))).toBe(false);
    expect(date.toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });

  it("rejects invalid or fixed-offset zones at the boundary", () => {
    for (const value of [
      "",
      "invalid/zone",
      "+01:00",
      "-08:00",
      "Europe/Paris ",
    ])
      expect(timeZoneSchema.safeParse(value).success).toBe(false);
    for (const value of [
      "UTC",
      "Europe/Paris",
      "America/Los_Angeles",
      "Etc/GMT+12",
    ])
      expect(timeZoneSchema.safeParse(value).success).toBe(true);
  });
});

it("preserves legacy instant comparisons and local day arithmetic near midnight and DST", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Europe/Paris";
    const instant = new Date("2026-09-30T22:30:00Z");
    expect(isSameDay(instant, new Date("2026-10-01T10:00:00Z"))).toBe(true);
    expect(isSameCalendarDay(instant, fromDateString("2026-10-01"))).toBe(
      false,
    );
    const beforeDST = new Date("2026-03-28T11:00:00Z");
    expect(addOneDay(beforeDST).toISOString()).toBe("2026-03-29T10:00:00.000Z");
    expect(removeOneDay(addOneDay(beforeDST)).toISOString()).toBe(
      beforeDST.toISOString(),
    );
    expect(addCalendarDay(fromDateString("2026-03-28")).toISOString()).toBe(
      "2026-03-29T00:00:00.000Z",
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
