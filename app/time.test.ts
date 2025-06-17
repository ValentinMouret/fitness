import { describe, it, expect } from "vitest";
import {
  allDays,
  Day,
  isSameDay,
  toDate,
  today,
  addOneDay,
  removeOneDay,
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
    it("should convert number to day correctly", () => {
      expect(Day.fromNumber(0)).toBe("Monday");
      expect(Day.fromNumber(1)).toBe("Tuesday");
      expect(Day.fromNumber(2)).toBe("Wednesday");
      expect(Day.fromNumber(3)).toBe("Thursday");
      expect(Day.fromNumber(4)).toBe("Friday");
      expect(Day.fromNumber(5)).toBe("Saturday");
      expect(Day.fromNumber(6)).toBe("Sunday");
    });

    it("should throw error for invalid numbers", () => {
      expect(() => Day.fromNumber(-1)).toThrow("Invalid day number");
      expect(() => Day.fromNumber(7)).toThrow("Invalid day number");
      expect(() => Day.fromNumber(10)).toThrow("Invalid day number");
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
});