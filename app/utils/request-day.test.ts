import { describe, expect, it } from "vitest";
import { toDateString, toLocalDateString } from "~/time";
import { requestDay } from "./request-day";

describe("device calendar days", () => {
  it("keeps the local calendar components rather than converting them to UTC", () => {
    expect(toLocalDateString(new Date(2030, 0, 5, 0, 30))).toBe("2030-01-05");
    expect(toLocalDateString(new Date(2032, 1, 29, 23, 59))).toBe("2032-02-29");
    expect(toLocalDateString(new Date(2030, 11, 31, 23, 59))).toBe(
      "2030-12-31",
    );
  });

  it("preserves the selected date-only day for loaders and writes", () => {
    expect(
      toDateString(
        requestDay(new Request("http://localhost/habits?day=2030-01-05")),
      ),
    ).toBe("2030-01-05");
  });

  for (const day of ["2030-02-30", "2030-13-01", "2030-01-05T00:00:00Z", ""]) {
    it(`rejects invalid date-only input ${day}`, () => {
      try {
        requestDay(
          new Request(`http://localhost/habits?day=${encodeURIComponent(day)}`),
        );
        throw new Error("Expected invalid day rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        if (error instanceof Response) expect(error.status).toBe(400);
      }
    });
  }
});
