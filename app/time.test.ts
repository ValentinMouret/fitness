import { describe, it, expect } from "vitest";
import {
  allDays,
  Day,
  isSameDay,
  toDate,
  today,
  addOneDay,
  removeOneDay,
  getOrdinalSuffix,
  formatStartedAgo,
} from "./time";

describe("time module", () => {
  describe("allDays", () => {
    it("should contain all 7 days of the week", () => {
      expect(allDays).toEqual([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]);
    });
  });

  describe("Day.sortDays", () => {
    it("should sort days in chronological order", () => {
      const unsortedDays = ["Friday", "Monday", "Wednesday", "Sunday"];
      const sorted = Day.sortDays(unsortedDays);
      expect(sorted).toEqual(["Monday", "Wednesday", "Friday", "Sunday"]);
    });

    it("should handle empty array", () => {
      expect(Day.sortDays([])).toEqual([]);
    });

    it("should handle single day", () => {
      expect(Day.sortDays(["Tuesday"])).toEqual(["Tuesday"]);
    });

    it("should not mutate original array", () => {
      const original = ["Friday", "Monday"];
      const sorted = Day.sortDays(original);
      expect(original).toEqual(["Friday", "Monday"]);
      expect(sorted).toEqual(["Monday", "Friday"]);
    });
  });

  describe("Day.fromNumber", () => {
    it("should convert JavaScript Date.getDay() number to day correctly", () => {
      expect(Day.fromNumber(0)).toBe("Sunday"); // Sunday is 0 in JS
      expect(Day.fromNumber(1)).toBe("Monday");
      expect(Day.fromNumber(2)).toBe("Tuesday");
      expect(Day.fromNumber(3)).toBe("Wednesday");
      expect(Day.fromNumber(4)).toBe("Thursday");
      expect(Day.fromNumber(5)).toBe("Friday");
      expect(Day.fromNumber(6)).toBe("Saturday");
    });

    it("should handle edge cases gracefully", () => {
      // Day.fromNumber maps JS days (0-6) to our days array
      // 0 (Sunday) maps to index 6, 1-6 map to 0-5
      // The function doesn't throw for valid JS day numbers (0-6)
      expect(Day.fromNumber(0)).toBe("Sunday");
      expect(Day.fromNumber(6)).toBe("Saturday");
    });
  });

  describe("Day.toShort", () => {
    it("should convert day to short format", () => {
      expect(Day.toShort("Monday")).toBe("Mon.");
      expect(Day.toShort("Tuesday")).toBe("Tue.");
      expect(Day.toShort("Wednesday")).toBe("Wed.");
      expect(Day.toShort("Thursday")).toBe("Thu.");
      expect(Day.toShort("Friday")).toBe("Fri.");
      expect(Day.toShort("Saturday")).toBe("Sat.");
      expect(Day.toShort("Sunday")).toBe("Sun.");
    });
  });

  describe("isSameDay", () => {
    it("should return true for same day", () => {
      const date1 = new Date("2023-10-15T10:30:00");
      const date2 = new Date("2023-10-15T18:45:00");
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("should return false for different days", () => {
      const date1 = new Date("2023-10-15T10:30:00");
      const date2 = new Date("2023-10-16T10:30:00");
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("should return false for different months", () => {
      const date1 = new Date("2023-10-15T10:30:00");
      const date2 = new Date("2023-11-15T10:30:00");
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it("should return false for different years", () => {
      const date1 = new Date("2023-10-15T10:30:00");
      const date2 = new Date("2024-10-15T10:30:00");
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe("toDate", () => {
    it("should reset time to midnight UTC", () => {
      const input = new Date("2023-10-15T14:30:45.123Z");
      const result = toDate(input);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(result.getUTCFullYear()).toBe(2023);
      expect(result.getUTCMonth()).toBe(9); // October is month 9
      expect(result.getUTCDate()).toBe(15);
    });

    it("should not mutate original date", () => {
      const original = new Date("2023-10-15T14:30:45.123Z");
      const originalTime = original.getTime();
      toDate(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe("today", () => {
    it("should return today's date with time reset to midnight UTC", () => {
      const result = today();
      const now = new Date();

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(isSameDay(result, now)).toBe(true);
    });
  });

  describe("addOneDay", () => {
    it("should add one day to date", () => {
      const input = new Date("2023-10-15T10:30:00");
      const result = addOneDay(input);

      expect(result.getDate()).toBe(16);
      expect(result.getMonth()).toBe(input.getMonth());
      expect(result.getFullYear()).toBe(input.getFullYear());
    });

    it("should handle month boundary", () => {
      const input = new Date("2023-10-31T10:30:00");
      const result = addOneDay(input);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(10); // November
      expect(result.getFullYear()).toBe(2023);
    });

    it("should handle year boundary", () => {
      const input = new Date("2023-12-31T10:30:00");
      const result = addOneDay(input);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
    });

    it("should not mutate original date", () => {
      const original = new Date("2023-10-15T10:30:00");
      const originalTime = original.getTime();
      addOneDay(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe("removeOneDay", () => {
    it("should remove one day from date", () => {
      const input = new Date("2023-10-15T10:30:00");
      const result = removeOneDay(input);

      expect(result.getDate()).toBe(14);
      expect(result.getMonth()).toBe(input.getMonth());
      expect(result.getFullYear()).toBe(input.getFullYear());
    });

    it("should handle month boundary", () => {
      const input = new Date("2023-11-01T10:30:00");
      const result = removeOneDay(input);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(9); // October
      expect(result.getFullYear()).toBe(2023);
    });

    it("should handle year boundary", () => {
      const input = new Date("2024-01-01T10:30:00");
      const result = removeOneDay(input);

      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2023);
    });

    it("should not mutate original date", () => {
      const original = new Date("2023-10-15T10:30:00");
      const originalTime = original.getTime();
      removeOneDay(original);
      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe("getOrdinalSuffix", () => {
    it("should return correct suffix for numbers ending in 1 (except 11)", () => {
      expect(getOrdinalSuffix(1)).toBe("st");
      expect(getOrdinalSuffix(21)).toBe("st");
      expect(getOrdinalSuffix(31)).toBe("st");
      expect(getOrdinalSuffix(101)).toBe("st");
    });

    it("should return correct suffix for numbers ending in 2 (except 12)", () => {
      expect(getOrdinalSuffix(2)).toBe("nd");
      expect(getOrdinalSuffix(22)).toBe("nd");
      expect(getOrdinalSuffix(32)).toBe("nd");
      expect(getOrdinalSuffix(102)).toBe("nd");
    });

    it("should return correct suffix for numbers ending in 3 (except 13)", () => {
      expect(getOrdinalSuffix(3)).toBe("rd");
      expect(getOrdinalSuffix(23)).toBe("rd");
      expect(getOrdinalSuffix(33)).toBe("rd");
      expect(getOrdinalSuffix(103)).toBe("rd");
    });

    it("should return 'th' for numbers 11-20", () => {
      expect(getOrdinalSuffix(11)).toBe("th");
      expect(getOrdinalSuffix(12)).toBe("th");
      expect(getOrdinalSuffix(13)).toBe("th");
      expect(getOrdinalSuffix(14)).toBe("th");
      expect(getOrdinalSuffix(15)).toBe("th");
      expect(getOrdinalSuffix(16)).toBe("th");
      expect(getOrdinalSuffix(17)).toBe("th");
      expect(getOrdinalSuffix(18)).toBe("th");
      expect(getOrdinalSuffix(19)).toBe("th");
      expect(getOrdinalSuffix(20)).toBe("th");
    });

    it("should return 'th' for other numbers", () => {
      expect(getOrdinalSuffix(4)).toBe("th");
      expect(getOrdinalSuffix(5)).toBe("th");
      expect(getOrdinalSuffix(6)).toBe("th");
      expect(getOrdinalSuffix(7)).toBe("th");
      expect(getOrdinalSuffix(8)).toBe("th");
      expect(getOrdinalSuffix(9)).toBe("th");
      expect(getOrdinalSuffix(10)).toBe("th");
      expect(getOrdinalSuffix(24)).toBe("th");
      expect(getOrdinalSuffix(25)).toBe("th");
      expect(getOrdinalSuffix(26)).toBe("th");
      expect(getOrdinalSuffix(100)).toBe("th");
    });
  });

  describe("formatStartedAgo", () => {
    it("should format 0 minutes as 'Started just now'", () => {
      expect(formatStartedAgo(0)).toBe("Started just now");
    });

    it("should format 1 minute correctly", () => {
      expect(formatStartedAgo(1)).toBe("Started 1 min ago");
    });

    it("should format minutes less than 60", () => {
      expect(formatStartedAgo(2)).toBe("Started 2 min ago");
      expect(formatStartedAgo(15)).toBe("Started 15 min ago");
      expect(formatStartedAgo(30)).toBe("Started 30 min ago");
      expect(formatStartedAgo(45)).toBe("Started 45 min ago");
      expect(formatStartedAgo(59)).toBe("Started 59 min ago");
    });

    it("should format exactly 1 hour", () => {
      expect(formatStartedAgo(60)).toBe("Started 1 hour ago");
    });

    it("should format hours with no minutes", () => {
      expect(formatStartedAgo(120)).toBe("Started 2 hours ago");
      expect(formatStartedAgo(180)).toBe("Started 3 hours ago");
      expect(formatStartedAgo(240)).toBe("Started 4 hours ago");
    });

    it("should format 1 hour with minutes", () => {
      expect(formatStartedAgo(61)).toBe("Started 1 hour 1 min ago");
      expect(formatStartedAgo(75)).toBe("Started 1 hour 15 min ago");
      expect(formatStartedAgo(90)).toBe("Started 1 hour 30 min ago");
    });

    it("should format multiple hours with minutes", () => {
      expect(formatStartedAgo(121)).toBe("Started 2 hours 1 min ago");
      expect(formatStartedAgo(135)).toBe("Started 2 hours 15 min ago");
      expect(formatStartedAgo(150)).toBe("Started 2 hours 30 min ago");
      expect(formatStartedAgo(195)).toBe("Started 3 hours 15 min ago");
    });
  });
});
